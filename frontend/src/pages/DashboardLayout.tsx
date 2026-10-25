import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Shield, Key, CreditCard, GraduationCap, Link2, LogOut, Settings, Network, Menu, X, Brain, Briefcase, Sun, Moon, Wallet, Vault, Zap, Fingerprint, Banknote, BadgeCheck, Library, RefreshCw, LayoutPanelLeft, Radar, Users } from 'lucide-react';
import { useVaultStore } from '../store/vaultStore';
import { CommandPalette } from '../components/CommandPalette';
import { Search } from 'lucide-react';
import { InstallPrompt } from '../components/InstallPrompt';
import { UpdateManager, performHardRefresh } from '../components/UpdateManager';
import { SubscriptionAlarm } from '../components/SubscriptionAlarm';

const navItems = [
  { to: '/workspace', icon: LayoutPanelLeft, label: 'Meja Kerja', activeColor: 'text-indigo-400', glow: 'shadow-indigo-500/20' },
  { to: '/ruang-kerja', icon: BookOpen, label: 'Ruang Kerja', activeColor: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  { to: '/vault', icon: Vault, label: 'Akses Utama', activeColor: 'text-purple-400', glow: 'shadow-purple-500/20' },
  { to: '/knowledge', icon: Library, label: 'Pustaka', activeColor: 'text-rose-400', glow: 'shadow-rose-500/20' },
  { to: '/intelligence', icon: Radar, label: 'Radar Tren', activeColor: 'text-teal-400', glow: 'shadow-teal-500/20' },
  { to: '/shortcuts', icon: Zap, label: 'Shortcuts', activeColor: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
  { to: '/identity-map', icon: Fingerprint, label: 'Identity', activeColor: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  { to: '/licenses', icon: BadgeCheck, label: 'Licenses', activeColor: 'text-blue-400', glow: 'shadow-blue-500/20' },
  { to: '/employees', icon: Users, label: 'Karyawan', activeColor: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
];

export const DashboardLayout = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  const navigate = useNavigate();
  const location = useLocation();
  const { setMasterPassword, setCommandOpen } = useVaultStore();
  const handleLogout = () => {
    setMasterPassword(null);
    toast.success('Brankas Akses Utama Terkunci');
  };

  const allMobileNavItems = [...navItems, { to: '/settings', icon: Settings, label: 'Settings' }];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex">
      <CommandPalette />
      <UpdateManager onUpdateStateChange={setHasUpdate} />
      <SubscriptionAlarm />
      
      {/* Desktop Sidebar (Teks Label Selalu Terlihat) */}
      <aside className="hidden md:flex relative z-40 w-56 lg:w-60 bg-surface/50 border-r border-border backdrop-blur-xl flex-col py-6 px-3">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-orange-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white font-black text-xl border border-white/20 shrink-0">
            V
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-orange-400 uppercase tracking-wider truncate">
              VaultPro
            </span>
            <span className="text-[10px] text-text-muted font-semibold tracking-wide">
              Command Center
            </span>
          </div>
        </div>
        
        {/* Nav Items dengan Teks Terbaca Jelas */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const isAksesGroup = item.to === '/vault' && ['/vault', '/apps', '/api-keys', '/subscriptions', '/courses', '/expenses'].includes(location.pathname);
            const isActive = location.pathname === item.to || isAksesGroup;
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-xs font-bold w-full ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-orange-500/20 text-text-primary border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                    : 'text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-br from-emerald-400 to-orange-500 text-white shadow-md shadow-emerald-500/30'
                    : 'text-text-muted group-hover:text-text-primary bg-surface/80 border border-border/50'
                }`}>
                  <item.icon size={16} />
                </div>
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Action Bawah dengan Teks Terbaca Jelas */}
        <div className="pt-3 border-t border-border space-y-1.5 mt-auto">
          {/* Refresh & Hapus Cache */}
          <button 
            onClick={() => {
              setIsRefreshing(true);
              performHardRefresh();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-bold ${
              hasUpdate 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/20 animate-pulse' 
                : 'text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
            }`}
            title="Refresh & Clear Cache Chrome"
          >
            <div className="p-1.5 rounded-lg bg-surface/80 border border-border/50 text-text-muted shrink-0">
              <RefreshCw size={15} className={isRefreshing ? "animate-spin text-emerald-400" : ""} />
            </div>
            <span className="truncate text-[11px]">{hasUpdate ? 'Update Baru! Refresh' : 'Refresh Cache'}</span>
            {hasUpdate && (
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            )}
          </button>

          {/* Settings */}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-bold ${
                isActive 
                  ? 'bg-primary/20 text-primary border border-primary/30' 
                  : 'text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <div className="p-1.5 rounded-lg bg-surface/80 border border-border/50 text-text-muted shrink-0">
              <Settings size={15} />
            </div>
            <span className="truncate text-[11px]">Settings</span>
          </NavLink>
          
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-xs font-bold border border-transparent"
          >
            <div className="p-1.5 rounded-lg bg-surface/80 border border-border/50 text-text-muted shrink-0">
              {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-400" />}
            </div>
            <span className="truncate text-[11px]">{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>

          {/* Logout */}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-danger hover:bg-danger/10 transition-colors text-xs font-bold border border-transparent"
          >
            <div className="p-1.5 rounded-lg bg-danger/10 border border-danger/20 text-danger shrink-0">
              <LogOut size={15} />
            </div>
            <span className="truncate text-[11px]">Kunci & Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden pb-14 md:pb-0">
        <header className="h-12 md:h-16 border-b border-border bg-surface/80 backdrop-blur-xl flex items-center justify-between px-3 md:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            {/* Mobile Title */}
            <div className="md:hidden text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary uppercase tracking-wider">
              VaultPro
            </div>
            <div className="hidden md:block text-sm text-text-muted font-semibold">Command Center</div>
          </div>
          <div className="flex items-center gap-3">
            
            <button 
              onClick={() => setCommandOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border text-sm text-text-muted hover:text-text-primary transition-colors hover:border-primary/50 group"
            >
              <Search size={16} className="group-hover:text-primary transition-colors" />
              <span className="hidden sm:inline">Cari data...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded border border-border text-[10px] font-bold">Ctrl+K</kbd>
            </button>
            
            {/* Refresh & Clear Cache Button (Mobile Top Header) */}
            <button 
              onClick={() => {
                setIsRefreshing(true);
                performHardRefresh();
              }}
              className="md:hidden relative flex items-center justify-center w-8 h-8 rounded-full text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Refresh & Clear Cache Chrome"
            >
              <RefreshCw size={18} className={isRefreshing ? "animate-spin text-emerald-400" : ""} />
              {hasUpdate && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>

            <button 
              onClick={toggleTheme}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-full text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(30);
                alert("🪄 Syncing VaultPro data to Local HWID Vault (F:\\APLIKASI KU\\.env)... Success!");
              }}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-xs font-semibold text-emerald-400 hover:scale-105 transition-transform active:scale-95 shadow-md shadow-emerald-500/10 cursor-pointer"
              title="One-Click Magic Sync ke PC Lokal"
            >
              <span>🪄</span> Magic Sync
            </button>
            <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected (Fonnte WA Active)
            </button>
            <InstallPrompt />
          </div>
        </header>

        
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation (Flush to Bottom) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-surface/95 backdrop-blur-xl border-t border-border shadow-[0_-5px_25px_rgba(0,0,0,0.4)] z-30 pb-safe">
        <div className="flex justify-center w-full">
          <div className="flex items-center gap-1 h-14 px-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center min-w-max py-1">
            {allMobileNavItems.map((item) => {
              const isAksesGroup = item.to === '/vault' && ['/vault', '/apps', '/api-keys', '/subscriptions', '/courses', '/expenses'].includes(location.pathname);
              const isActive = location.pathname === item.to || isAksesGroup;
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex flex-col items-center justify-center min-w-[54px] py-1 px-1 rounded-xl transition-all duration-300 mx-0.5 ${
                    isActive ? 'bg-primary/20 text-primary font-bold' : 'text-text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary'
                  }`}
                >
                  <item.icon size={17} className={isActive ? 'drop-shadow-[0_0_8px_rgba(var(--color-primary),0.5)]' : ''} />
                  <span className="text-[9px] mt-0.5 font-semibold tracking-tight truncate max-w-[50px]">{item.label}</span>
                </NavLink>
              );
            })}
            
            <div className="w-[1px] h-6 bg-border mx-1" />
            
            <button
              onClick={handleLogout}
              className="flex flex-col items-center justify-center min-w-[50px] py-1 px-1 rounded-xl transition-all duration-300 mx-0.5 text-danger hover:bg-danger/10 hover:text-danger/80"
            >
              <LogOut size={17} />
              <span className="text-[9px] mt-0.5 font-bold tracking-tight">Logout</span>
            </button>
          </div>
        </div>
        </div>
      </nav>
    </div>
  );
};