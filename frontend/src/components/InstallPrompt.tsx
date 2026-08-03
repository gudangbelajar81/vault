import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt if not already dismissed in this session
      if (!sessionStorage.getItem('pwa-prompt-dismissed')) {
        setIsVisible(true);
      }
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-surface/90 backdrop-blur-xl border border-primary/30 p-4 rounded-2xl shadow-[0_10px_40px_rgba(var(--color-primary),0.3)] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary shrink-0">
          <Download size={20} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-text-primary text-sm">Install VaultPro</h3>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Tambahkan ke layar utama untuk akses lebih cepat dan pengalaman aplikasi layar penuh.
          </p>
          <div className="flex gap-2 mt-3">
            <button 
              onClick={handleInstall}
              className="flex-1 bg-primary text-white text-xs font-bold py-2 rounded-lg active:scale-95 transition-transform"
            >
              Install Sekarang
            </button>
          </div>
        </div>
        <button 
          onClick={handleDismiss}
          className="text-text-muted hover:text-text-primary p-1 -mt-1 -mr-1"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
