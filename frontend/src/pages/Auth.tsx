import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVaultStore } from '../store/vaultStore';
import { Shield, Fingerprint, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

export const Auth = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterPassword, setMasterPasswordLocal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setMasterPassword } = useVaultStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !masterPassword) return;

    setLoading(true);
    try {
      if (isRegister) {
        await axios.post(`${API_URL}/api/auth/register`, { email, password });
      }
      
      await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      }, { withCredentials: true });

      // Save master password in memory
      setMasterPassword(masterPassword);
      toast.success(isRegister ? 'Account created successfully!' : 'Vault unlocked!');
      navigate('/vault');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-3 md:p-4 bg-bg-primary">
      <div className="flex flex-col items-center mb-4 md:mb-8">
        <Shield size={32} className="text-primary mb-2 md:mb-4 md:h-12 md:w-12" />
        <h1 className="text-2xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary uppercase tracking-wider">
          VaultPro
        </h1>
        <p className="text-[11px] md:text-lg text-text-muted text-center max-w-md mt-1.5 md:mt-2 px-2 md:px-4">
          Personal Digital Command Center. Securely manage your passwords, API keys, and subscriptions.
        </p>
      </div>
      
      <div className="p-3 md:p-8 rounded-2xl bg-surface/50 border border-border backdrop-blur-xl max-w-md w-full shadow-[0_0_40px_rgba(var(--color-primary),0.1)]">
        
        {/* Toggle Login/Register */}
        <div className="flex bg-black/5 dark:bg-black/40 rounded-lg p-0.5 md:p-1 mb-3 md:mb-6 border border-border">
          <button 
            type="button"
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-1.5 md:py-2 text-[11px] md:text-sm font-bold rounded-md transition-colors ${!isRegister ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-primary'}`}
          >
            Login
          </button>
          <button 
            type="button"
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-1.5 md:py-2 text-[11px] md:text-sm font-bold rounded-md transition-colors ${isRegister ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-primary'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 md:gap-5">
          <div>
            <label className="text-[11px] md:text-sm font-medium text-text-muted mb-1 block">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1 md:px-4 md:py-3 text-[11px] md:text-base text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div className="relative">
            <label className="text-[11px] md:text-sm font-medium text-text-muted mb-1 block">Account Password (Login)</label>
            <input 
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1 md:px-4 md:py-3 pr-10 text-[11px] md:text-base text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="••••••••"
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 md:right-3 top-[17px] md:top-8 text-text-muted hover:text-primary transition-colors p-1"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          
          <div className="h-px w-full bg-border my-0.5 md:my-2"></div>
          
          <div className="relative">
            <label className="text-[11px] md:text-sm font-medium text-text-muted mb-1 block">
              {isRegister ? 'Master Password (Rahasia untuk Enkripsi)' : 'Master Password (Decryption)'}
            </label>
            <input 
              type={showMasterPassword ? "text" : "password"}
              value={masterPassword}
              onChange={(e) => setMasterPasswordLocal(e.target.value)}
              required
              className="w-full bg-black/5 dark:bg-black/40 border border-primary/50 rounded-lg px-2.5 py-1 md:px-4 md:py-3 pr-10 text-[11px] md:text-base text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="Kunci Utama Vault..."
            />
            <button 
              type="button" 
              onClick={() => setShowMasterPassword(!showMasterPassword)}
              className="absolute right-2 md:right-3 top-[17px] md:top-8 text-text-muted hover:text-primary transition-colors p-1"
            >
              {showMasterPassword ? <EyeOff size={14} className="md:w-4 md:h-4" /> : <Eye size={14} className="md:w-4 md:h-4" />}
            </button>
            <p className="text-[10px] md:text-xs text-text-muted mt-1.5 md:mt-2 flex items-center gap-1">
              <Shield size={12} className="shrink-0" /> 
              <span>{isRegister ? 'PENTING: Jangan lupakan ini. Jika lupa, data hangus!' : 'Master Password tidak pernah dikirim ke server.'}</span>
            </p>
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="mt-1 md:mt-2 w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-1.5 md:py-3 px-4 rounded-lg transition-transform active:scale-95 flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(var(--color-primary),0.3)] text-[12px] md:text-base"
          >
            {loading ? 'Memproses...' : (isRegister ? 'Create Account & Unlock' : 'Unlock Vault')}
          </button>
          
          <button 
            type="button"
            className="w-full bg-surface hover:bg-surface/80 border border-border text-text-primary font-medium py-1.5 md:py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2 text-[12px] md:text-base"
          >
            <Fingerprint size={16} className="md:w-[18px] md:h-[18px]" />
            Unlock with Biometrics
          </button>
        </form>
      </div>
    </div>
  );
};
