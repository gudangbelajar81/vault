import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Key, CreditCard, GraduationCap, Link2, LogOut, Settings, Network, Menu, X, Brain, Briefcase, Sun, Moon, Wallet, Vault, Zap, Fingerprint, Banknote, BadgeCheck, Library } from 'lucide-react';
import { useVaultStore } from '../store/vaultStore';
import { CommandPalette } from '../components/CommandPalette';
import { Search } from 'lucide-react';
import { InstallPrompt } from '../components/InstallPrompt';

const navItems = [
  { to: '/vault', icon: Vault, label: 'Akses Utama', activeColor: 'text-purple-400', glow: 'shadow-purple-500/20' },
  { to: '/shortcuts', icon: Zap, label: 'Shortcuts', activeColor: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
  { to: '/identity-map', icon: Fingerprint, label: 'Identity', activeColor: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  { to: '/expenses', icon: Banknote, label: 'Pengeluaran', activeColor: 'text-green-400', glow: 'shadow-green-500/20' },
  { to: '/licenses', icon: BadgeCheck, label: 'Licenses', activeColor: 'text-blue-400', glow: 'shadow-blue-500/20' },
  { to: '/knowledge', icon: Library, label: 'Pustaka', activeColor: 'text-rose-400', glow: 'shadow-rose-500/20' },
];

export const DashboardLayout = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

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
    navigate('/');
  };

  const allMobileNavItems = [...navItems, { to: '/settings', icon: Settings, label: 'Settings' }];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex">
      <CommandPalette />
      {/* Desktop Sidebar (Ultra Compact Icon-Only) */}
      <aside className="hidden md:flex relative z-40 w-20 bg-surface/50 border-r border-border backdrop-blur-xl flex-col items-center py-6">
        <div className="mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-orange-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white font-black text-xl border border-white/20">
            V
          </div>
        </div>
        
        <nav className="flex-1 space-y-4">
          {navItems.map((item) => {
            const isAksesGroup = item.to === '/vault' && ['/vault', '/api-keys', '/subscriptions', '/courses'].includes(location.pathname);
            const isActive = location.pathname === item.to || isAksesGroup;
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-br from-emerald-400 to-orange-500 text-white font-semibold shadow-lg shadow-emerald-500/30 border border-white/20' 
                    : 'text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <item.icon size={22} />
                
                {/* Tooltip melayang di atas icon (Desktop) */}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-bold text-text-primary pointer-events-none transition-all duration-200 whitespace-nowrap shadow-xl z-50 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100">
                  {item.label}
                  {/* Segitiga panah bawah */}
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-surface border-b border-r border-border rotate-45"></span>
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-border space-y-4 mt-auto">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${
                isActive ? 'bg-primary/20 text-primary font-semibold' : 'text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Settings size={22} />
                {/* Tooltip */}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-bold text-text-primary pointer-events-none transition-all duration-200 whitespace-nowrap shadow-xl z-50 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100">
                  Settings
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-surface border-b border-r border-border rotate-45"></span>
                </span>
              </>
            )}
          </NavLink>
          
          <button 
            onClick={toggleTheme}
            className="group relative flex items-center justify-center w-12 h-12 rounded-xl text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
            {/* Tooltip Theme */}
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-bold text-text-primary pointer-events-none transition-all duration-200 whitespace-nowrap shadow-xl z-50 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-surface border-b border-r border-border rotate-45"></span>
            </span>
          </button>

          <button 
            onClick={handleLogout}
            className="group relative flex items-center justify-center w-12 h-12 rounded-xl text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut size={22} />
            {/* Tooltip Logout */}
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-danger text-white rounded-lg text-xs font-bold pointer-events-none transition-all duration-200 whitespace-nowrap shadow-xl shadow-danger/20 z-50 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100">
              Lock & Logout
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-danger rotate-45"></span>
            </span>
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
            <div className="hidden md:block text-sm text-text-muted">Command Center</div>
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
          <div className="flex items-center gap-1 h-14 px-2">
            <div className="flex items-center min-w-max py-2">
            {allMobileNavItems.map((item) => {
              const isAksesGroup = item.to === '/vault' && ['/vault', '/api-keys', '/subscriptions', '/courses'].includes(location.pathname);
              const isActive = location.pathname === item.to || isAksesGroup;
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`group relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 mx-1 ${
                    isActive ? 'bg-primary/20 text-primary' : 'text-text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary'
                  }`}
                >
                  <item.icon size={18} className={isActive ? 'drop-shadow-[0_0_8px_rgba(var(--color-primary),0.5)]' : ''} />
                  
                  {/* Tooltip melayang di atas icon */}
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-surface border border-border rounded-lg text-[10px] font-bold text-text-primary pointer-events-none transition-all duration-200 whitespace-nowrap shadow-xl z-50 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-active:opacity-100 group-active:scale-100">
                    {item.label}
                    {/* Segitiga panah bawah */}
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-surface border-b border-r border-border rotate-45"></span>
                  </span>
                </NavLink>
              );
            })}
            
            <div className="w-[1px] h-5 bg-border mx-1" />
            
            <button
              onClick={handleLogout}
              className="group relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 mx-1 text-danger hover:bg-danger/10 hover:text-danger/80"
            >
              <LogOut size={18} />
              
              {/* Tooltip melayang di atas icon Logout */}
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-danger text-white rounded-lg text-[10px] font-bold pointer-events-none transition-all duration-200 whitespace-nowrap shadow-xl shadow-danger/20 z-50 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-active:opacity-100 group-active:scale-100">
                Logout
                {/* Segitiga panah bawah */}
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-danger rotate-45"></span>
              </span>
            </button>
          </div>
        </div>
        </div>
      </nav>
    </div>
  );
};
