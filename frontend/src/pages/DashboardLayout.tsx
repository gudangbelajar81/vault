import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Key, CreditCard, GraduationCap, Link2, LogOut, Settings, Network, Menu, X } from 'lucide-react';
import { useVaultStore } from '../store/vaultStore';
import { InstallPrompt } from '../components/InstallPrompt';

const navItems = [
  { to: '/vault', icon: Shield, label: 'Vault' },
  { to: '/api-keys', icon: Key, label: 'API Keys' },
  { to: '/subscriptions', icon: CreditCard, label: 'Subs' },
  { to: '/courses', icon: GraduationCap, label: 'Courses' },
  { to: '/shortcuts', icon: Link2, label: 'Shortcuts' },
  { to: '/identity-map', icon: Network, label: 'Identity' },
];

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setMasterPassword } = useVaultStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    setMasterPassword(null);
    navigate('/');
  };

  // Top 4 items for bottom nav
  const bottomNavItems = navItems.slice(0, 4);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 bg-surface/50 border-r border-border backdrop-blur-xl flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary uppercase tracking-wider">
            VaultPro
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-primary/20 text-primary font-semibold shadow-[0_0_15px_rgba(var(--color-primary),0.2)]' 
                    : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                isActive ? 'bg-primary/20 text-primary font-semibold' : 'text-text-muted hover:text-text-primary hover:bg-white/5'
              }`
            }
          >
            <Settings size={20} />
            <span>Settings</span>
          </NavLink>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut size={20} />
            <span>Lock & Logout</span>
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
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              A
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-2 md:p-8 relative">
          <InstallPrompt />
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-border z-30 pb-safe">
        <div className="flex items-center gap-5 sm:gap-8 h-14 px-4 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          <div className="flex mx-auto items-center gap-5 sm:gap-8 min-w-max">
            {bottomNavItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex-shrink-0 min-w-[52px] flex flex-col items-center justify-center h-full gap-1 transition-colors ${
                    isActive ? 'text-primary' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <item.icon size={20} className={isActive ? 'drop-shadow-[0_0_8px_rgba(var(--color-primary),0.5)]' : ''} />
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </NavLink>
              );
            })}
            
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex-shrink-0 min-w-[52px] flex flex-col items-center justify-center h-full gap-1 text-text-muted hover:text-text-primary transition-colors"
            >
              <Menu size={18} />
              <span className="text-[10px] font-medium leading-none">More</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile More Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-bg-primary/95 backdrop-blur-md animate-in fade-in duration-200 flex flex-col">
          <div className="h-12 border-b border-border flex items-center justify-between px-4">
            <h2 className="font-bold text-sm">More Options</h2>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-text-muted hover:text-text-primary">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {navItems.slice(4).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border"
              >
                <item.icon size={20} className="text-primary" />
                <span className="font-semibold text-sm">{item.label}</span>
              </NavLink>
            ))}
            <div className="h-px bg-border my-2" />
            <NavLink
              to="/settings"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border"
            >
              <Settings size={20} className="text-text-muted" />
              <span className="font-semibold text-sm">Settings</span>
            </NavLink>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger mt-3"
            >
              <LogOut size={20} />
              <span className="font-semibold text-sm">Lock & Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
