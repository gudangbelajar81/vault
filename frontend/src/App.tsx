import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { DashboardLayout } from './pages/DashboardLayout';
import { Vault } from './pages/Vault';
import { Subscriptions } from './pages/Subscriptions';
import { ApiKeys } from './pages/ApiKeys';
import { Courses } from './pages/Courses';
import { Shortcuts } from './pages/Shortcuts';
import { Settings } from './pages/Settings';
import { IdentityMap } from './pages/IdentityMap';
import { useVaultStore } from './store/vaultStore';

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
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#111116',
            color: '#fff',
            border: '1px solid #2a2a35',
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
          <Route path="/vault" element={<Vault />} />
          <Route path="/api-keys" element={<ApiKeys />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/shortcuts" element={<Shortcuts />} />
          <Route path="/identity-map" element={<IdentityMap />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </>
  );
}

export default App;
