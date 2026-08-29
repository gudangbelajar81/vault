import React, { useState, useRef } from 'react';
import { Mic, Square, X, Loader2, Play, Volume2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useVaultStore } from '../store/vaultStore';
import { decryptData, encryptData } from '../utils/crypto';
import { API_URL } from '../config';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export const VoiceRecorderModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { masterPassword } = useVaultStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState('');
  const [title, setTitle] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop()); // Stop mic
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      let seconds = 0;
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        seconds += 1;
        setRecordingTime(seconds);
      }, 1000);

    } catch (err) {
      console.error(err);
      toast.error('Gagal mengakses mikrofon. Pastikan izin telah diberikan.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const processAudio = async () => {
    if (!audioBlob || !masterPassword) return;
    
    if (!title) {
      toast.error('Masukkan judul seminar/rekaman terlebih dahulu.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Fetch Omni Router Config from Vault
      const vaultRes = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      let groqKeys: string[] = [];
      let provider = 'groq';
      let omniBaseUrl = 'https://api.groq.com/openai/v1/chat/completions';
      
      if (vaultRes.data.success) {
        for (const item of vaultRes.data.data) {
          if (item.type === 'api' && item.title === 'Groq API Key (Omni Router)') {
            try {
              const dec = JSON.parse(await decryptData(item.encryptedData, masterPassword));
              provider = dec.provider || 'groq';
              if (dec.baseUrl) omniBaseUrl = dec.baseUrl;
              const rawKeys = dec.keys || dec.key || '';
              groqKeys = rawKeys.split(/[\n,]+/).map((k: string) => k.trim()).filter((k: string) => k);
            } catch (e) {}
            break;
          }
        }
      }

      if (groqKeys.length === 0) {
        toast.error('Kunci API Omni Router tidak ditemukan. Atur di menu Settings.');
        setIsProcessing(false);
        return;
      }

      let audioUrl = omniBaseUrl.replace('/chat/completions', '/audio/transcriptions');
      if (!audioUrl.includes('audio/transcriptions')) {
        audioUrl = 'https://api.groq.com/openai/v1/audio/transcriptions'; // fallback
      }
      
      let audioModel = 'whisper-large-v3-turbo'; // Groq default
      if (provider === 'openai') audioModel = 'whisper-1';

      // 2. Prepare FormData
      const formData = new FormData();
      // Audio blob needs to be cast as File
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      formData.append('file', file);
      formData.append('model', audioModel);
      formData.append('response_format', 'text');

      // 3. Transcribe with Rotator
      let transcriptionText = '';
      let success = false;
      
      for (let i = 0; i < groqKeys.length; i++) {
        try {
          toast(`Mentranskripsi Audio (${audioModel}) - Key ${i+1}...`, { icon: '🤖' });
          const res = await axios.post(audioUrl, formData, {
            headers: {
              'Authorization': `Bearer ${groqKeys[i]}`,
              'Content-Type': 'multipart/form-data'
            }
          });
          transcriptionText = res.data;
          success = true;
          break;
        } catch (err: any) {
          console.error('Audio Transcription Error:', err);
          if (err.response?.status >= 400 && err.response?.status < 500 && err.response?.status !== 429) {
            break; // Stop if not a rate limit
          }
        }
      }

      if (!success || !transcriptionText) {
        throw new Error('Gagal mentranskripsi audio dengan semua kunci API.');
      }
      
      setTranscription(transcriptionText);

      // 4. Summarize with Llama/GPT
      toast('Membuat Ringkasan Otomatis...', { icon: '✨' });
      let chatModel = 'llama-3.3-70b-versatile';
      if (provider === 'openai') chatModel = 'gpt-4o-mini';
      
      const summaryPrompt = `Berikut adalah transkrip dari rekaman suara / seminar:
\n${transcriptionText}\n
Buatlah ringkasan eksekutif dan poin-poin penting (bullet points) dari transkrip di atas dengan rapi.`;

      let summaryText = transcriptionText; // Fallback

      for (let i = 0; i < groqKeys.length; i++) {
        try {
          const res = await axios.post(omniBaseUrl, {
            model: chatModel,
            messages: [{ role: 'user', content: summaryPrompt }],
            temperature: 0.3
          }, {
            headers: {
              'Authorization': `Bearer ${groqKeys[i]}`,
              'Content-Type': 'application/json'
            }
          });
          summaryText = res.data.choices[0].message.content;
          break;
        } catch (err: any) {
          // ignore, use next key
        }
      }

      // 5. Save to Vault
      const finalContent = `# Transkripsi Penuh:\n${transcriptionText}\n\n# Ringkasan AI:\n${summaryText}`;
      
      const dataToEncrypt = JSON.stringify({
        category: 'prompt', // We save it under Prompt/Notes tab
        title: title,
        url: '',
        content: finalContent
      });

      const encryptedData = await encryptData(dataToEncrypt, masterPassword);

      await axios.post(`${API_URL}/api/vault`, {
        type: 'knowledge',
        name: title,
        encryptedData
      }, { withCredentials: true });

      toast.success('Voice Note & Ringkasan berhasil disimpan ke Pustaka!');
      onSuccess();
      onClose();

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Gagal memproses audio.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface w-full max-w-md rounded-3xl shadow-2xl border border-border">
        
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Mic size={24} className="text-rose-500" />
            AI Voice Notes
          </h2>
          <button onClick={onClose} disabled={isProcessing} className="p-2 hover:bg-black/5 rounded-xl text-text-muted transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center">
          <input
            type="text"
            placeholder="Judul Rekaman / Seminar..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isRecording || isProcessing || audioBlob !== null}
            className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-rose-500 transition-colors mb-8 text-center font-bold"
          />

          {!audioBlob ? (
            <div className="flex flex-col items-center">
              <div className="text-4xl font-mono font-black text-text-primary mb-8 tracking-wider">
                {formatTime(recordingTime)}
              </div>
              
              {!isRecording ? (
                <button 
                  onClick={startRecording}
                  className="w-24 h-24 rounded-full bg-rose-500/10 border-4 border-rose-500 flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-[0_0_30px_rgba(244,63,94,0.3)] hover:scale-105"
                >
                  <Mic size={40} />
                </button>
              ) : (
                <button 
                  onClick={stopRecording}
                  className="w-24 h-24 rounded-full bg-white border-4 border-rose-500 flex items-center justify-center text-rose-500 hover:bg-rose-100 transition-all shadow-[0_0_30px_rgba(244,63,94,0.5)] animate-pulse"
                >
                  <Square size={32} fill="currentColor" />
                </button>
              )}
              <p className="mt-6 text-sm text-text-muted">
                {!isRecording ? 'Tekan untuk merekam suara' : 'Merekam... Tekan untuk berhenti'}
              </p>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-6">
              <div className="w-full bg-black/5 dark:bg-white/5 p-4 rounded-2xl flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                  <Volume2 size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-text-primary text-sm">Rekaman Selesai</p>
                  <p className="text-xs text-text-muted">Durasi: {formatTime(recordingTime)}</p>
                </div>
              </div>
              
              <div className="flex w-full gap-3">
                <button 
                  onClick={() => { setAudioBlob(null); setRecordingTime(0); }}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-surface border border-border rounded-xl font-bold text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  Buang & Ulangi
                </button>
                <button 
                  onClick={processAudio}
                  disabled={isProcessing}
                  className="flex-[2] py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/25 disabled:opacity-80"
                >
                  {isProcessing ? (
                    <><Loader2 size={18} className="animate-spin" /> Sedang Memproses...</>
                  ) : (
                    <><Mic size={18} /> Transkrip & Ringkas via AI</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
