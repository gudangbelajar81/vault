import React, { useState, useEffect } from 'react';
import {
  FileText, StickyNote, Paintbrush, Table2, Bookmark,
  BookOpen, Download, Upload, ShieldCheck, Timer, CloudUpload, CloudDownload, Loader2
} from 'lucide-react';
import { NotesPanel } from '../components/ruang-kerja/NotesPanel';
import { StickiesPanel } from '../components/ruang-kerja/StickiesPanel';
import { DrawingPanel } from '../components/ruang-kerja/DrawingPanel';
import { SheetsPanel } from '../components/ruang-kerja/SheetsPanel';
import { BookmarksPanel } from '../components/ruang-kerja/BookmarksPanel';
import { PomodoroPanel } from '../components/ruang-kerja/PomodoroPanel';
import { wsStorage } from '../services/workspaceStorage';
import toast from 'react-hot-toast';

type TabType = 'notes' | 'stickies' | 'drawing' | 'sheets' | 'bookmarks' | 'pomodoro' | 'backup';

export const RuangKerja: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const fileImportRef = React.useRef<HTMLInputElement>(null);

  const tabs: { id: TabType; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'notes', label: 'Catatan', icon: <FileText size={16} />, color: 'text-cyan-400' },
    { id: 'stickies', label: 'Tempel', icon: <StickyNote size={16} />, color: 'text-amber-400' },
    { id: 'drawing', label: 'Gambar', icon: <Paintbrush size={16} />, color: 'text-emerald-400' },
    { id: 'sheets', label: 'Tabel', icon: <Table2 size={16} />, color: 'text-blue-400' },
    { id: 'bookmarks', label: 'Bookmark', icon: <Bookmark size={16} />, color: 'text-purple-400' },
    { id: 'pomodoro', label: 'Fokus Pomodoro', icon: <Timer size={16} />, color: 'text-rose-400' },
    { id: 'backup', label: 'Ekspor & Cadangan', icon: <Download size={16} />, color: 'text-rose-400' },
  ];

  const handleExportBackup = async () => {
    try {
      const json = await wsStorage.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ruang-kerja-vaultpro-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      toast.success('Cadangan Ruang Kerja berhasil diekspor!');
    } catch {
      toast.error('Gagal mengekspor data cadangan');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      const ok = await wsStorage.importAllData(content);
      if (ok) {
        toast.success('Data Ruang Kerja berhasil dipulihkan!');
        window.location.reload();
      } else {
        toast.error('Format file cadangan tidak valid');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Cloud Sync ──
  const [isSyncingUp, setIsSyncingUp] = useState(false);
  const [isSyncingDown, setIsSyncingDown] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{ syncedAt: string; deviceInfo?: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'backup') {
      wsStorage.getCloudSyncStatus().then(setCloudStatus);
    }
  }, [activeTab]);

  const handlePushCloud = async () => {
    setIsSyncingUp(true);
    try {
      const result = await wsStorage.pushToCloud();
      if (result.success) {
        toast.success(result.message);
        if (result.syncedAt) setCloudStatus({ syncedAt: result.syncedAt });
      } else {
        toast.error(result.message);
      }
    } finally {
      setIsSyncingUp(false);
    }
  };

  const handlePullCloud = async () => {
    if (!window.confirm('Menarik data dari cloud akan MENIMPA data Ruang Kerja di perangkat ini. Lanjutkan?')) return;
    setIsSyncingDown(true);
    try {
      const result = await wsStorage.pullFromCloud();
      if (result.success && result.hasData) {
        toast.success(result.message);
        window.location.reload();
      } else if (result.success && !result.hasData) {
        toast(result.message);
      } else {
        toast.error(result.message);
      }
    } finally {
      setIsSyncingDown(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto min-h-[calc(100vh-80px)] flex flex-col gap-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 flex items-center gap-3">
            <BookOpen size={28} className="text-cyan-400" />
            Ruang Kerja
          </h1>
          <p className="text-xs md:text-sm text-text-muted mt-1">
            Buku Catatan Pintar, Tempelan Memo, Whiteboard Canvas & Spreadsheet Terpadu
          </p>
        </div>

        {/* Quick Sync Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-xl text-xs font-semibold text-emerald-400 shadow-sm">
          <ShieldCheck size={14} />
          <span>Penyimpanan Lokal Aktif & Aman</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border shrink-0 select-none">
        {tabs.map(t => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className={isActive ? t.color : 'text-text-muted'}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'notes' && <NotesPanel />}
        {activeTab === 'stickies' && <StickiesPanel />}
        {activeTab === 'drawing' && <DrawingPanel />}
        {activeTab === 'sheets' && <SheetsPanel />}
        {activeTab === 'bookmarks' && <BookmarksPanel />}
        {activeTab === 'pomodoro' && <PomodoroPanel />}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-xl mx-auto space-y-6">
            <input
              ref={fileImportRef}
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />

            <div>
              <h3 className="font-bold text-base text-text-primary">Cadangan & Ekspor Data Ruang Kerja</h3>
              <p className="text-xs text-text-muted mt-1">
                Semua catatan, halaman, sticky notes, coretan whiteboard, tabel, dan bookmark Anda tersimpan di perangkat ini. Anda bisa mencadangkan seluruh data menjadi satu file JSON.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExportBackup}
                className="flex items-center justify-center gap-2 p-4 rounded-xl bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 shadow-lg shadow-cyan-500/20 transition-all"
              >
                <Download size={16} /> Ekspor File Cadangan (.json)
              </button>

              <button
                onClick={() => fileImportRef.current?.click()}
                className="flex items-center justify-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-border text-text-primary font-bold text-xs transition-all"
              >
                <Upload size={16} /> Impor / Pulihkan Cadangan
              </button>
            </div>

            <div className="border-t border-border pt-5">
              <h3 className="font-bold text-base text-text-primary">Sinkronisasi Cloud (Backend MySQL)</h3>
              <p className="text-xs text-text-muted mt-1">
                Simpan snapshot Ruang Kerja ke server agar bisa diakses dari perangkat lain. Data dikirim via koneksi aman dengan sesi akun Anda.
              </p>
              {cloudStatus && (
                <p className="text-xs text-emerald-400 mt-2 font-semibold">
                  Terakhir disinkronkan: {new Date(cloudStatus.syncedAt).toLocaleString('id-ID')}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <button
                  onClick={handlePushCloud}
                  disabled={isSyncingUp}
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-indigo-500 text-white font-bold text-xs hover:bg-indigo-400 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncingUp ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                  {isSyncingUp ? 'Mengunggah...' : 'Push ke Cloud'}
                </button>

                <button
                  onClick={handlePullCloud}
                  disabled={isSyncingDown}
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-border text-text-primary font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncingDown ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />}
                  {isSyncingDown ? 'Menarik...' : 'Pull dari Cloud'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
