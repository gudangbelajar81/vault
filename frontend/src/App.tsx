import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { DashboardLayout } from './pages/DashboardLayout';
import { Vault } from './pages/Vault';
import { AppManager } from './pages/AppManager';
import { Subscriptions } from './pages/Subscriptions';
import { ApiKeys } from './pages/ApiKeys';
import { Courses } from './pages/Courses';
import { Shortcuts } from './pages/Shortcuts';
import { Settings } from './pages/Settings';
import { IdentityMap } from './pages/IdentityMap';
import { LicenseManager } from './pages/LicenseManager';
import { AccessLayout } from './pages/AccessLayout';
import { Expenses } from './pages/Expenses';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { useVaultStore } from './store/vaultStore';
import { InstallPrompt } from './components/InstallPrompt';

import { Toaster } from 'react-hot-toast';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isUnlocked = useVaultStore((state) => state.isUnlocked);
  
  if (!isUnlocked) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <>
      <InstallPrompt />
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: 'var(--theme-surface)',
            color: 'var(--theme-text-primary)',
            border: '1px solid var(--theme-border)',
            fontSize: '14px',
            borderRadius: '12px'
          },
        }} 
      />
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<Auth />} />
        
        {/* Dashboard Routes (Protected) */}
        <Route 
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Grouped Access Routes */}
          <Route element={<AccessLayout />}>
            <Route path="/vault" element={<Vault />} />
            <Route path="/apps" element={<AppManager />} />
            <Route path="/api-keys" element={<ApiKeys />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/expenses" element={<Expenses />} />
          </Route>
          
          <Route path="/shortcuts" element={<Shortcuts />} />
          <Route path="/identity-map" element={<IdentityMap />} />
          <Route path="/licenses" element={<LicenseManager />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </>
  );
}

export default App;
