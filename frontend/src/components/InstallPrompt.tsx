import React, { useEffect, useState } from 'react';
import { Download, X, ShieldCheck } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Jangan tampilkan jika pengguna sudah menolak (dismiss) secara permanen
      const isDismissed = localStorage.getItem('installPromptDismissed');
      if (!isDismissed) {
        // Beri sedikit jeda agar tidak terlalu agresif saat baru buka halaman
        setTimeout(() => setShowPrompt(true), 1500);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Tampilkan prompt bawaan OS/Browser
    deferredPrompt.prompt();
    
    // Tunggu pilihan pengguna
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    
    // Prompt hanya bisa dipanggil sekali
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Simpan status agar tidak muncul terus-menerus
    localStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="bg-surface/90 backdrop-blur-xl border border-primary/40 p-4 rounded-2xl shadow-[0_8px_30px_rgba(var(--color-primary),0.3)] flex flex-col gap-3">
        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 text-text-muted hover:text-white transition-colors bg-black/20 rounded-full"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-4">
          <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-xl shrink-0 shadow-lg relative overflow-hidden">
             <div className="absolute inset-0 bg-white/20 blur-[2px]"></div>
             <Download size={24} className="text-white relative z-10" />
          </div>
          <div className="flex-1 pr-6">
            <h3 className="text-[13px] font-black text-text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
              Pasang Aplikasi <ShieldCheck size={14} className="text-primary" />
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Karena Bos gampang lupa URL, pasang VaultPro ke <strong>Layar Utama</strong> HP/PC sekarang. Aman sekelas Enterprise, dan bisa diakses seperti aplikasi Native.
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-1">
          <button 
            onClick={handleInstall}
            className="flex-1 bg-primary hover:bg-primary/90 text-white text-[12px] font-bold py-2.5 rounded-xl transition-all active:scale-95 shadow-[0_0_15px_rgba(var(--color-primary),0.4)]"
          >
            Install Sekarang
          </button>
          <button 
            onClick={handleDismiss}
            className="px-4 bg-black/20 hover:bg-black/40 border border-border text-text-muted text-[12px] font-semibold rounded-xl transition-colors"
          >
            Nanti Saja
          </button>
        </div>
      </div>
    </div>
  );
};
