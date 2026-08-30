import React, { useState, useEffect, useRef } from 'react';
import { Save, Mic, Image as ImageIcon, Camera, CheckCircle2, Trash2, StopCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useVaultStore } from '../store/vaultStore';
import { decryptData } from '../utils/crypto';

import { API_URL } from '../config';

export const SmartNotepad: React.FC = () => {
  const { masterPassword } = useVaultStore();
  const [text, setText] = useState('');
  
  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Image State
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-load draft
  useEffect(() => {
    const draft = localStorage.getItem('smart_notepad_draft');
    if (draft) setText(draft);
  }, []);

  // Auto-save draft on type
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    localStorage.setItem('smart_notepad_draft', val);
  };
  
  // Listen to cross-component updates (from Calculator)
  useEffect(() => {
    const handleStorage = () => {
      const draft = localStorage.getItem('smart_notepad_draft');
      if (draft) setText(draft);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const clearDraft = () => {
    if (confirm('Yakin ingin menghapus semua catatan ini?')) {
      setText('');
      localStorage.removeItem('smart_notepad_draft');
    }
  };

  const handleSaveToVault = () => {
    toast.success('Catatan draf sudah aman di HP ini.');
  };

  // ================= AI HELPERS =================
  const getAiKeys = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      let groqKey = '';
      let openRouterKey = '';
      let geminiKey = '';
      
      if (res.data.success) {
        for (const item of res.data.data) {
          if (item.type === 'api' || item.type === 'api_key') {
            try {
              if (!masterPassword) continue;
              const dec = JSON.parse(await decryptData(item.encryptedData, masterPassword));
              
              let extractedKey = '';
              if (dec.keys && dec.keys.length > 0) {
                 extractedKey = dec.keys[0];
              } else if (dec.accounts) {
                 for (const acc of dec.accounts) {
                   if (acc.apis) {
                     for (const api of acc.apis) {
                       if (api.key && api.key.length > 5) {
                         extractedKey = api.key;
                         break;
                       }
                     }
                   }
                 }
              }
              
              if (item.title === 'Groq API Key (Omni Router)') groqKey = extractedKey;
              if (item.title === 'OpenRouter API Key') openRouterKey = extractedKey;
              if (item.title === 'Gemini API Key') geminiKey = extractedKey;
            } catch (e) {}
          }
        }
      }
      return { groqKey, openRouterKey, geminiKey };
    } catch (e) {
      return { groqKey: '', openRouterKey: '', geminiKey: '' };
    }
  };

  // ================= VOICE PINTAR (GROQ WHISPER + TRANSLATE) =================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Merekam suara... Bicaralah sekarang.');
    } catch (error) {
      toast.error('Gagal mengakses mikrofon. Pastikan izin diberikan.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessingVoice(true);
    const toastId = toast.loading('Mengubah suara jadi teks & menerjemahkan...');
    try {
      const keys = await getAiKeys();
      if (!keys.groqKey) throw new Error('Groq API Key belum dikonfigurasi di menu Kunci API.');

      // 1. Transcribe with Whisper
      const formData = new FormData();
      formData.append('file', new File([audioBlob], 'audio.webm', { type: 'audio/webm' }));
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'text');

      const whisperRes = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
        headers: {
          'Authorization': `Bearer ${keys.groqKey}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const transcript = whisperRes.data;
      if (!transcript) throw new Error('Suara tidak terdengar.');

      // 2. Translate/Refine with LLaMA 3
      const chatRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an expert translator. The user provides a raw audio transcription. If it is in a foreign language, translate it to natural Bahasa Indonesia. If it is already in Bahasa Indonesia, just fix the punctuation and grammar. Output ONLY the final Bahasa Indonesia text, nothing else.' },
          { role: 'user', content: transcript }
        ],
        temperature: 0.3
      }, {
        headers: { 'Authorization': `Bearer ${keys.groqKey}` }
      });

      const finalResult = chatRes.data.choices[0].message.content.trim();
      
      // Append to Notepad
      const newText = text ? `${text}\n${finalResult}` : finalResult;
      setText(newText);
      localStorage.setItem('smart_notepad_draft', newText);
      
      toast.success('Selesai!', { id: toastId });
    } catch (error: any) {
      toast.error(error.message || 'Gagal memproses suara.', { id: toastId });
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // ================= FOTO PINTAR (GEMINI / GPT-4o VISION) =================
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to Base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      processImage(base64Data);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  };

  const processImage = async (base64Image: string) => {
    setIsProcessingImage(true);
    const toastId = toast.loading('Membaca gambar & menerjemahkan teks...');
    
    try {
      const keys = await getAiKeys();
      // We prioritize OpenRouter (Gemini/GPT4o), fallback to native Gemini API if needed.
      let apiKey = keys.openRouterKey;
      let baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
      let modelName = 'google/gemini-1.5-flash';

      if (!apiKey && keys.geminiKey) {
         // Direct Gemini URL fallback? For simplicity we require OpenRouter or assume the user has set it.
         // Actually, let's just demand OpenRouter for now.
      }
      
      if (!apiKey) throw new Error('OpenRouter API Key belum dikonfigurasi di menu Kunci API. (Dibutuhkan untuk Foto Pintar)');

      const chatRes = await axios.post(baseUrl, {
        model: modelName,
        messages: [
          { 
            role: 'user', 
            content: [
              { type: 'text', text: 'Extract all the text from this image. If the text is NOT in Indonesian, translate it accurately to natural Bahasa Indonesia. Output ONLY the resulting Bahasa Indonesia text. Do not add any conversational filler like "Here is the translated text". Just the raw text.' },
              { type: 'image_url', image_url: { url: base64Image } }
            ]
          }
        ]
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      const finalResult = chatRes.data.choices[0].message.content.trim();
      
      // Append to Notepad
      const newText = text ? `${text}\n${finalResult}` : finalResult;
      setText(newText);
      localStorage.setItem('smart_notepad_draft', newText);
      
      toast.success('Gambar berhasil dibaca!', { id: toastId });
    } catch (error: any) {
      toast.error(error.message || 'Gagal membaca gambar.', { id: toastId });
    } finally {
      setIsProcessingImage(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-2xl overflow-hidden shadow-sm relative">
      {/* Header Toolbar */}
      <div className="bg-black/5 dark:bg-white/5 border-b border-border p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* Voice Button */}
          {!isRecording ? (
            <button 
              onClick={startRecording}
              disabled={isProcessingVoice}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
            >
              {isProcessingVoice ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />} 
              <span className="hidden sm:inline">Voice Pintar</span>
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 animate-pulse text-white rounded-lg text-xs font-bold shadow-sm"
            >
              <StopCircle size={14} /> Berhenti
            </button>
          )}
          
          {/* Image Button */}
          
          {/* Gallery Input */}
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleImageUpload} 
          />
          {/* Camera Input */}
          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            id="cameraInput"
            className="hidden" 
            onChange={handleImageUpload} 
          />
          
          <div className="flex bg-indigo-500 rounded-lg overflow-hidden shadow-sm disabled:opacity-50">
            <button 
              onClick={() => document.getElementById('cameraInput')?.click()}
              disabled={isProcessingImage}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-indigo-600 text-white text-xs font-bold transition-colors border-r border-indigo-400/30"
              title="Kamera Langsung"
            >
              {isProcessingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
              <span className="hidden sm:inline">Kamera</span>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingImage}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-indigo-600 text-white text-xs font-bold transition-colors"
              title="Pilih dari Galeri"
            >
              <span className="hidden sm:inline">Galeri</span>
            </button>
          </div>

        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted flex items-center gap-1 hidden md:flex">
            <CheckCircle2 size={10} className="text-emerald-500" /> Auto-Save
          </span>
          <button 
            onClick={clearDraft}
            className="p-1.5 text-text-muted hover:text-danger rounded-lg transition-colors"
            title="Hapus Semua"
          >
            <Trash2 size={14} />
          </button>
          <button 
            onClick={handleSaveToVault}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            <Save size={14} /> <span className="hidden sm:inline">Simpan</span>
          </button>
        </div>
      </div>

      {/* Lined Paper Editor */}
      <div className="flex-1 relative bg-[#fdfdfc] dark:bg-[#1e1e1e] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(156, 163, 175, 0.3) 31px, rgba(156, 163, 175, 0.3) 32px)',
          backgroundAttachment: 'local'
        }}></div>
        <textarea
          value={text}
          onChange={handleChange}
          placeholder="Ketik catatan atau gunakan AI Voice/Foto di atas..."
          className="absolute inset-0 w-full h-full resize-none bg-transparent outline-none text-gray-800 dark:text-gray-200 text-base"
          style={{ 
            lineHeight: '32px',
            padding: '2px 16px',
            backgroundAttachment: 'local'
          }}
          spellCheck={false}
        />
      </div>
    </div>
  );
};
