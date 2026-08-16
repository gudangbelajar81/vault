import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col items-center justify-center p-6">
          <div className="bg-surface border border-danger/30 p-8 rounded-3xl max-w-2l w-full text-center shadow-2xl shadow-danger/10">
            <div className="w-20 h-20 bg-danger/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="text-danger" size={40} />
            </div>
            <h1 className="text-2xl font-black mb-4">Sistem Mendeteksi Kesalahan</h1>
            <p className="text-text-muted mb-6">
              Terjadi kesalahan pada aplikasi (*Runtime Error*). Silakan klik tombol di bawah untuk memuat ulang, atau foto larar ini ke tim teknis.
            </p>
            
            {this.state.error && (
              <div className="bg-black/20 p-4 rounded-xl text-left overflow-x-auto mb-8 border border-border">
                <code className="text-sm font-mono text-rose-400">
                  {this.state.error.toString()}
                </code>
              </div>
            )}

            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl font-bold inline-flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
            >
              <RefreshCw size={20} />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
