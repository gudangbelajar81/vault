import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  LockKeyhole, Box, Code2, RefreshCw, Compass, Banknote, Users,
  ShieldCheck, Fingerprint, Eye, EyeOff, Lock, KeyRound, Sparkles, Loader2 
} from 'lucide-react';
import { useVaultStore } from '../store/vaultStore';
import localforage from 'localforage';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_URL } from '../config';
import { startAuthentication } from '@simplewebauthn/browser';
import { encryptForDevice, decryptForDevice } from '../utils/crypto';

const tabs = [
  { to: '/vault', icon: LockKeyhole, label: 'Kubah' },
  { to: '/apps', icon: Box, label: 'App Manager' },
  { to: '/api-keys', icon: Code2, label: 'Kunci API' },
  { to: '/subscriptions', icon: RefreshCw, label: 'Sub' },
  { to: '/courses', icon: Compass, label: 'Kursus' },
  { to: '/expenses', icon: Banknote, label: 'Pengeluaran' },
  { to: '/employees', icon: Users, label: 'Karyawan' },
];

export const AccessLayout = () => {
  const { isUnlocked, masterPassword, setMasterPassword } = useVaultStore();
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savedMaster, setSavedMaster] = useState<string | null>(null);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  useEffect(() => {
    localforage.getItem('savedMasterPassword').then(async (val) => {
      if (!val || typeof val !== 'string') return;
      try {
        // Coba dekripsi format baru (terenkripsi dengan device key)
        const decrypted = await decryptForDevice(val);
        setSavedMaster(decrypted);
      } catch {
        // Fallback: data lama masih plaintext (sebelum fix keamanan ini).
        // Migrasi otomatis: pakai nilainya, lalu timpa dengan versi terenkripsi.
        setSavedMaster(val);
        try {
          const migrated = await encryptForDevice(val);
          await localforage.setItem('savedMasterPassword', migrated);
        } catch (migErr) {
          console.error('Gagal migrasi enkripsi savedMasterPassword:', migErr);
        }
      }
    });
    localforage.getItem('savedEmail').then((val) => {
      if (val && typeof val === 'string') setSavedEmail(val);
    });
  }, []);

  const handleUnlock = async (pwd: string) => {
    if (!pwd || !pwd.trim()) {
      toast.error('Masukkan Master Password');
      return;
    }
    const cleanPwd = pwd.trim();
    setMasterPassword(cleanPwd);
    // Simpan terenkripsi (AES-256-GCM, key non-extractable terikat perangkat ini)
    // alih-alih plaintext mentah di IndexedDB.
    const encrypted = await encryptForDevice(cleanPwd);
    await localforage.setItem('savedMasterPassword', encrypted);
    toast.success('Brankas Akses Utama Terbuka!');
  };


  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUnlock(passwordInput);
  };

  const handleBiometricUnlock = async () => {
    const emailToUse = savedEmail || 'admin@vaultpro.local';
    setBioLoading(true);
    try {
      const optionsRes = await axios.post(`${API_URL}/api/webauthn/generate-authentication-options`, {
        email: emailToUse,
        rpID: window.location.hostname,
        origin: window.location.origin,
      });

      let asseResp;
      try {
        asseResp = await startAuthentication(optionsRes.data.data);
      } catch (err: any) {
        toast.error(err.message || 'Verifikasi biometrik dibatalkan');
        setBioLoading(false);
        return;
      }

      const verificationRes = await axios.post(`${API_URL}/api/webauthn/verify-authentication`, {
        email: emailToUse,
        response: asseResp,
        rpID: window.location.hostname,
        origin: window.location.origin,
      });

      if (verificationRes.data.success) {
        const stored = (await localforage.getItem('savedMasterPassword')) as string;
        if (stored) {
          try {
            const decrypted = await decryptForDevice(stored);
            setMasterPassword(decrypted);
            toast.success('Brankas terbuka via Biometrik!');
          } catch {
            // Data lama masih plaintext (belum sempat dimigrasi) -> pakai langsung
            setMasterPassword(stored);
            toast.success('Brankas terbuka via Biometrik!');
          }
        } else {
          toast.error('Biometrik sukses, silakan masukkan Master Password sekali untuk verifikasi.');
        }
      }

    } catch (error: any) {
      console.error(error);
      toast.error('Biometrik gagal, gunakan password manual.');
    } finally {
      setBioLoading(false);
    }
  };

  const handleLockVault = () => {
    setMasterPassword(null);
    toast('Brankas Akses Utama Terkunci', { icon: '🔒' });
  };

  // ================= TEMBOK PENGAMAN (GATE VIEW) =================
  if (!isUnlocked || !masterPassword) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-3 md:p-6 min-h-[calc(100vh-120px)]">
        <div className="w-full max-w-md p-5 md:p-7 rounded-2xl bg-surface/70 border border-border backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-primary/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg mb-3">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-text-primary tracking-tight">
              Gerbang Akses Utama
            </h2>
            <p className="text-xs text-text-muted mt-1 max-w-xs">
              Satu pintu masuk berpagar aman untuk Kubah, App Manager, Kunci API, Sub, Kursus, Pengeluaran, & Karyawan.
            </p>
          </div>

          {/* Password Form */}
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="relative">
              <label className="text-xs font-semibold text-text-muted mb-1 block">
                Master Password (Kunci Brankas)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Ketik Master Password..."
                  autoFocus
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-xl px-3.5 py-2.5 pr-10 text-xs md:text-sm text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-4 rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(var(--color-primary),0.3)] text-xs md:text-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
              Buka Brankas (Unlock)
            </button>

            {/* Quick 1-Click Unlock with Stored Key */}
            {savedMaster && (
              <button
                type="button"
                onClick={() => handleUnlock(savedMaster)}
                className="w-full bg-surface border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 font-semibold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Sparkles size={14} className="text-emerald-400" />
                Buka Cepat (Kunci Tersimpan)
              </button>
            )}

            {/* Biometric Button */}
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={bioLoading}
              className="w-full bg-surface/50 hover:bg-surface border border-border text-text-primary font-medium py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs disabled:opacity-50"
            >
              {bioLoading ? (
                <RefreshCw size={15} className="animate-spin text-primary" />
              ) : (
                <Fingerprint size={15} className="text-primary" />
              )}
              Buka dengan Sidik Jari (Biometrik)
            </button>
          </form>

          {/* Bottom Security Note */}
          <div className="mt-5 pt-4 border-t border-border/60 text-center">
            <span className="text-[10px] text-text-muted flex items-center justify-center gap-1">
              <KeyRound size={12} className="text-primary" />
              Cukup login 1 kali untuk membuka seluruh 7 modul data sensitif.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ================= UNLOCKED (ACTIVE HOUSE VIEW) =================
  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Tabs Navigation (Ultra Compact 1-Row with Lock Button) */}
      <div className="sticky top-0 z-20 bg-bg-primary/80 backdrop-blur-xl border-b border-border pt-safe px-2 py-2">
        <div className="flex items-center justify-between gap-1 w-full overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-full whitespace-nowrap text-[10px] sm:text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-primary text-bg-primary shadow-[0_0_10px_rgba(var(--color-primary),0.3)]'
                      : 'bg-surface text-text-muted hover:bg-surface-light hover:text-text-primary border border-border'
                  }`
                }
              >
                <tab.icon size={12} className="sm:w-3.5 sm:h-3.5" />
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Quick Lock Button */}
          <button
            onClick={handleLockVault}
            title="Kunci Kembali Akses Utama"
            className="shrink-0 flex items-center gap-1 text-[10px] sm:text-xs font-bold text-danger/80 hover:text-danger bg-danger/10 hover:bg-danger/20 border border-danger/20 px-2.5 py-1.5 rounded-full transition-all active:scale-95 ml-1"
          >
            <Lock size={12} />
            <span className="hidden sm:inline">Kunci</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
};
