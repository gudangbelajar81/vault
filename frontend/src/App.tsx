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
import { Employees } from './pages/Employees';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Workspace } from './pages/Workspace';
import { RuangKerja } from './pages/RuangKerja';
import { IntelligenceHub } from './pages/IntelligenceHub';
import { ShareReceiver } from './pages/ShareReceiver';
import { InstallPrompt } from './components/InstallPrompt';
import { Toaster } from 'react-hot-toast';

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
          {/* Main Dashboard Layout (Unblocked & Fast Personal Access) */}
          <Route element={<DashboardLayout />}>
            {/* Landing default: Meja Kerja (Instant workspace without login barrier) */}
            <Route path="/" element={<Navigate to="/workspace" replace />} />

            {/* 1 Rumah Akses Utama (Dilindungi Tembok Pengaman 1x Login) */}
            <Route element={<AccessLayout />}>
              <Route path="/vault" element={<Vault />} />
              <Route path="/apps" element={<AppManager />} />
              <Route path="/api-keys" element={<ApiKeys />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/employees" element={<Employees />} />
            </Route>
            
            {/* Menu Bebas Keluar Masuk (Tanpa Gembok) */}
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/ruang-kerja" element={<RuangKerja />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
            <Route path="/intelligence" element={<IntelligenceHub />} />
            <Route path="/shortcuts" element={<Shortcuts />} />
            <Route path="/identity-map" element={<IdentityMap />} />
            <Route path="/licenses" element={<LicenseManager />} />
            <Route path="/share" element={<ShareReceiver />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Standalone Auth fallback jika dibutuhkan */}
          <Route path="/login" element={<Auth />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
