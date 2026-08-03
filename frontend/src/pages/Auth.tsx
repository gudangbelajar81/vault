import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVaultStore } from '../store/vaultStore';
import { Shield, Fingerprint, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
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
      navigate('/vault');
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-bg-primary">
      <div className="flex flex-col items-center mb-6 md:mb-8">
        <Shield size={40} className="text-primary mb-3 md:mb-4 md:h-12 md:w-12" />
        <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary uppercase tracking-wider">
          VaultPro
        </h1>
        <p className="text-text-muted text-sm md:text-lg text-center max-w-md mt-2 px-4">
          Personal Digital Command Center. Securely manage your passwords, API keys, and subscriptions.
        </p>
      </div>
      
      <div className="p-6 md:p-8 rounded-2xl bg-surface/50 border border-border backdrop-blur-xl max-w-md w-full shadow-[0_0_40px_rgba(var(--color-primary),0.1)]">
        
        {/* Toggle Login/Register */}
        <div className="flex bg-black/40 rounded-lg p-1 mb-6 border border-border">
          <button 
            type="button"
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${!isRegister ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-white'}`}
          >
            Login
          </button>
          <button 
            type="button"
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${isRegister ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-white'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:gap-5">
          <div>
            <label className="text-xs md:text-sm font-medium text-text-muted mb-1 block">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-black/40 border border-border rounded-lg px-3 py-2.5 md:px-4 md:py-3 text-sm md:text-base text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div className="relative">
            <label className="text-xs md:text-sm font-medium text-text-muted mb-1 block">Account Password (Login)</label>
            <input 
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-black/40 border border-border rounded-lg px-3 py-2.5 md:px-4 md:py-3 pr-10 text-sm md:text-base text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="••••••••"
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-7 md:top-8 text-text-muted hover:text-primary transition-colors p-1"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          
          <div className="h-px w-full bg-border my-1 md:my-2"></div>
          
          <div className="relative">
            <label className="text-xs md:text-sm font-medium text-text-muted mb-1 block">
              {isRegister ? 'Master Password (Rahasia untuk Enkripsi)' : 'Master Password (Decryption)'}
            </label>
            <input 
              type={showMasterPassword ? "text" : "password"}
              value={masterPassword}
              onChange={(e) => setMasterPasswordLocal(e.target.value)}
              required
              className="w-full bg-black/40 border border-primary/50 rounded-lg px-3 py-2.5 md:px-4 md:py-3 pr-10 text-sm md:text-base text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="Kunci Utama Vault..."
            />
            <button 
              type="button" 
              onClick={() => setShowMasterPassword(!showMasterPassword)}
              className="absolute right-3 top-7 md:top-8 text-text-muted hover:text-primary transition-colors p-1"
            >
              {showMasterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <p className="text-[10px] md:text-xs text-text-muted mt-1.5 md:mt-2 flex items-center gap-1">
              <Shield size={12} className="shrink-0" /> 
              <span>{isRegister ? 'PENTING: Jangan lupakan ini. Jika lupa, data hangus!' : 'Master Password tidak pernah dikirim ke server.'}</span>
            </p>
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-2.5 md:py-3 px-4 rounded-lg transition-transform active:scale-95 flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(var(--color-primary),0.3)] text-sm md:text-base"
          >
            {loading ? 'Memproses...' : (isRegister ? 'Create Account & Unlock' : 'Unlock Vault')}
          </button>
          
          <button 
            type="button"
            className="w-full bg-surface hover:bg-surface/80 border border-border text-text-primary font-medium py-2.5 md:py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2 text-sm md:text-base"
          >
            <Fingerprint size={18} />
            Unlock with Biometrics
          </button>
        </form>
      </div>
    </div>
  );
};
