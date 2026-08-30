import React, { useState, useEffect } from 'react';
import { Save, Mic, Image as ImageIcon, CheckCircle2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const SmartNotepad: React.FC = () => {
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

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

  const clearDraft = () => {
    if (confirm('Yakin ingin menghapus semua catatan ini?')) {
      setText('');
      localStorage.removeItem('smart_notepad_draft');
    }
  };

  const handleVoice = () => {
    toast.error('Voice Pintar (Groq Whisper) sedang dikonfigurasi. Akan hadir di update berikutnya!');
  };

  const handleImage = () => {
    toast.error('Foto Pintar (Gemini Vision) sedang dikonfigurasi. Akan hadir di update berikutnya!');
  };

  const handleSaveToVault = () => {
    // To be implemented: Encrypt and save to /api/vault
    toast.success('Catatan draf sudah aman di HP ini.');
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-2xl overflow-hidden shadow-sm relative">
      {/* Header Toolbar */}
      <div className="bg-black/5 dark:bg-white/5 border-b border-border p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleVoice}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            <Mic size={14} /> Voice
          </button>
          <button 
            onClick={handleImage}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            <ImageIcon size={14} /> Foto Pintar
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted flex items-center gap-1 hidden md:flex">
            <CheckCircle2 size={10} className="text-emerald-500" /> Auto-Save Aktif
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
            <Save size={14} /> Simpan
          </button>
        </div>
      </div>

      {/* Lined Paper Editor */}
      <div className="flex-1 relative bg-[#fdfdfc] dark:bg-[#1e1e1e] overflow-hidden">
        {/* CSS Magic for Lined Paper */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(transparent 95%, #e5e7eb 95%)',
          backgroundSize: '100% 2rem',
          opacity: 0.8
        }}></div>
        <textarea
          value={text}
          onChange={handleChange}
          placeholder="Ketik catatan di sini..."
          className="absolute inset-0 w-full h-full resize-none bg-transparent outline-none p-4 text-gray-800 dark:text-gray-200 text-sm leading-[2rem]"
          style={{ lineHeight: '2rem' }}
          spellCheck={false}
        />
      </div>
    </div>
  );
};
