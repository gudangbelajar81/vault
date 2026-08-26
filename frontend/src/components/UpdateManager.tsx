import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

export const CURRENT_BUILD_VERSION = "1.0.6";

// Function to perform hard refresh & clear all Chrome cache
export const performHardRefresh = async (onStatusChange?: (msg: string) => void) => {
  if (onStatusChange) onStatusChange("Cleaning Chrome Cache...");

  try {
    // 1. Clear CacheStorage
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => caches.delete(key)));
    }

    // 2. Unregister Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // 3. Clear SessionStorage (keep localStorage for authentication)
    sessionStorage.clear();

    if (onStatusChange) onStatusChange("Reloading with fresh assets...");

    // 4. Force browser to reload bypassing cache using query parameter
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      window.location.href = url.toString();
    }, 400);

  } catch (error) {
    console.error("Hard refresh error:", error);
    window.location.reload();
  }
};

export const UpdateManager: React.FC<{
  onUpdateStateChange?: (hasUpdate: boolean) => void;
}> = ({ onUpdateStateChange }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    // Check for updates by fetching /version.json
    const checkForUpdates = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
        if (res.ok) {
          const data = await res.json();
          const currentBuild = localStorage.getItem('vault_app_version');
          
          if (currentBuild && data.version && data.version !== currentBuild) {
            setUpdateAvailable(true);
            if (onUpdateStateChange) onUpdateStateChange(true);
          } else {
            localStorage.setItem('vault_app_version', data.version || CURRENT_BUILD_VERSION);
          }
        }
      } catch (err) {
        // Silently fail if offline or dev
      }
    };

    // SW update listener
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
                if (onUpdateStateChange) onUpdateStateChange(true);
              }
            };
          }
        };
      });
    }

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 20000); // Check every 20s

    return () => clearInterval(interval);
  }, []);

  const handleUpdateClick = () => {
    setIsRefreshing(true);
    performHardRefresh((msg) => setStatusMsg(msg));
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed top-4 right-4 sm:top-5 sm:right-5 z-[100] max-w-sm w-[calc(100%-2rem)] animate-in slide-in-from-top-5 duration-300">
      <div className="bg-surface/90 backdrop-blur-xl border border-emerald-500/50 p-4 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.25)] flex flex-col gap-3 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl pointer-events-none"></div>

        <button 
          onClick={() => setDismissed(true)} 
          className="absolute top-3 right-3 p-1 text-text-muted hover:text-text-primary rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shrink-0 shadow-md">
            <Sparkles size={20} className="animate-bounce" />
          </div>
          <div className="pr-5">
            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              Update Baru Tersedia! <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </h4>
            <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
              Pembaruan aplikasi dari server/lokal telah siap. Hapus cache lama untuk menerapkan update.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleUpdateClick}
            disabled={isRefreshing}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-[11px] font-bold py-2 px-3 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? (statusMsg || 'Memuat...') : 'Perbarui & Hapus Cache'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-2 bg-black/5 dark:bg-white/5 border border-border text-text-muted hover:text-text-primary text-[11px] font-semibold rounded-xl transition-colors"
          >
            Nanti
          </button>
        </div>
      </div>
    </div>
  );
};
