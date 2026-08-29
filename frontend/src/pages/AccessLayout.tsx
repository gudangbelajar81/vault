import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Shield, Key, CreditCard, GraduationCap, LockKeyhole, Code2, RefreshCw, Compass, Box } from 'lucide-react';

const tabs = [
  { to: '/vault', icon: LockKeyhole, label: 'Kubah' },
  { to: '/apps', icon: Box, label: 'App Manager' },
  { to: '/api-keys', icon: Code2, label: 'Kunci API' },
  { to: '/subscriptions', icon: RefreshCw, label: 'Sub' },
  { to: '/courses', icon: Compass, label: 'Kursus' },
];

export const AccessLayout = () => {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Tabs Navigation (Ultra Compact 1-Row) */}
      <div className="sticky top-0 z-20 bg-bg-primary/80 backdrop-blur-xl border-b border-border pt-safe px-2 py-2">
        <div className="flex items-center justify-between gap-1 w-full">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-full whitespace-nowrap text-[10px] sm:text-xs font-bold transition-all duration-300 ${
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
      </div>
      
      {/* Content Area */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
};
