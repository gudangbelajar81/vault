import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Shield, Key, CreditCard, GraduationCap, Link2, LogOut, Settings, Network } from 'lucide-react';
import { useVaultStore } from '../store/vaultStore';

const navItems = [
  { to: '/vault', icon: Shield, label: 'Password Vault' },
  { to: '/api-keys', icon: Key, label: 'API Keys' },
  { to: '/subscriptions', icon: CreditCard, label: 'Subscriptions' },
  { to: '/courses', icon: GraduationCap, label: 'Courses' },
  { to: '/shortcuts', icon: Link2, label: 'Shortcuts' },
  { to: '/identity-map', icon: Network, label: 'Identity Map' },
];

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const { setMasterPassword } = useVaultStore();

  const handleLogout = () => {
    // Call API logout
    setMasterPassword(null);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex">
      {/* Sidebar */}
      <aside className="w-64 bg-surface/50 border-r border-border backdrop-blur-xl flex flex-col">
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
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 border-b border-border bg-surface/30 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="text-sm text-text-muted">Command Center</div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              A
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8 relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
