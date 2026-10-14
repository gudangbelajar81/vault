import React, { useState, useEffect, useRef } from 'react';
import { Table2, Plus, Trash2, ArrowLeft, Download, Undo2 } from 'lucide-react';
import { wsStorage, type SheetItem } from '../../services/workspaceStorage';
import toast from 'react-hot-toast';

export const SheetsPanel: React.FC = () => {
  const [sheets, setSheets] = useState<SheetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SheetItem | null>(null);
  const [grid, setGrid] = useState<string[][]>([['', '', ''], ['', '', ''], ['', '', '']]);
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoStackRef = useRef<string[][][]>([]);

  const load = async () => {
    try {
      const data = await wsStorage.getSheets();
      setSheets(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openSheet = (s: SheetItem) => {
    setActive(s);
    setTitle(s.title);
    try {
      setGrid(JSON.parse(s.data));
    } catch {
      setGrid([['', '', ''], ['', '', ''], ['', '', '']]);
    }
    undoStackRef.current = [];
  };

  const handleCreate = async () => {
    const newSheet = await wsStorage.saveSheet({ title: 'Tabel Baru' });
    await load();
    openSheet(newSheet);
    toast.success('Tabel spreadsheet baru dibuat');
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Hapus tabel ini?')) return;
    await wsStorage.deleteSheet(id);
    if (active?.id === id) setActive(null);
    load();
    toast.success('Tabel dihapus');
  };

  const pushUndoSnapshot = () => {
    undoStackRef.current = [...undoStackRef.current.slice(-19), grid.map(r => [...r])];
  };

  const applyGridChange = (ng: string[][]) => {
    setGrid(ng);
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (active) {
        await wsStorage.saveSheet({ id: active.id, title, data: JSON.stringify(ng) });
        setSaved(true);
      }
    }, 800);
  };

  const cellChange = (r: number, c: number, val: string) => {
    pushUndoSnapshot();
    const ng = grid.map((row, ri) => row.map((cell, ci) => ri === r && ci === c ? val : cell));
    applyGridChange(ng);
  };

  const addRow = () => {
    pushUndoSnapshot();
    const cols = grid[0]?.length || 3;
    setGrid([...grid, new Array(cols).fill('')]);
    setSaved(false);
  };

  const addCol = () => {
    pushUndoSnapshot();
    setGrid(grid.map(r => [...r, '']));
    setSaved(false);
  };

  const deleteRow = (ri: number) => {
    if (grid.length <= 1) {
      toast.error('Minimal harus ada 1 baris');
      return;
    }
    pushUndoSnapshot();
    applyGridChange(grid.filter((_, i) => i !== ri));
  };

  const deleteCol = (ci: number) => {
    if ((grid[0]?.length || 0) <= 1) {
      toast.error('Minimal harus ada 1 kolom');
      return;
    }
    pushUndoSnapshot();
    applyGridChange(grid.map(row => row.filter((_, i) => i !== ci)));
  };

  const undoGrid = () => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    setGrid(prev);
    setSaved(false);
    if (active) {
      wsStorage.saveSheet({ id: active.id, title, data: JSON.stringify(prev) });
      setSaved(true);
    }
  };

  const exportCSV = () => {
    const csv = grid.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title || 'tabel'}.csv`;
    a.click();
    toast.success('File CSV berhasil diunduh');
  };

  if (active) {
    return (
      <div className="flex flex-col gap-3 h-[calc(100vh-140px)]">
        {/* Top Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-border rounded-2xl shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActive(null); load(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-white/5 border border-border"
            >
              <ArrowLeft size={14} /> Kembali
            </button>

            <input
              type="text"
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                setSaved(false);
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => {
                  wsStorage.saveSheet({ id: active.id, title: e.target.value, data: JSON.stringify(grid) });
                  setSaved(true);
                }, 800);
              }}
              className="bg-transparent border-none text-base md:text-lg font-black text-text-primary outline-none focus:ring-0 w-56 md:w-80"
              placeholder="Judul Tabel..."
            />

            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              saved ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10 animate-pulse'
            }`}>
              {saved ? '✓ Tersimpan' : '● Menyimpan...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={undoGrid}
              disabled={undoStackRef.current.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary disabled:opacity-40 border border-border"
            >
              <Undo2 size={13} /> Urungkan
            </button>
            <button
              onClick={addRow}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-border text-text-primary"
            >
              + Baris
            </button>
            <button
              onClick={addCol}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-border text-text-primary"
            >
              + Kolom
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="flex-1 bg-surface border border-border rounded-2xl overflow-auto p-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <td className="w-8"></td>
                {(grid[0] || []).map((_, ci) => (
                  <td key={ci} className="text-center p-1 text-xs font-mono text-text-muted">
                    <div className="flex items-center justify-center gap-1">
                      <span>{String.fromCharCode(65 + ci)}</span>
                      <button
                        onClick={() => deleteCol(ci)}
                        className="text-text-muted hover:text-rose-400 p-0.5"
                        title={`Hapus kolom ${ci + 1}`}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, ri) => (
                <tr key={ri} className="border-t border-border/40">
                  <td className="text-center p-1 text-xs font-mono text-text-muted border-r border-border/40">
                    <div className="flex items-center justify-center gap-1">
                      <span>{ri + 1}</span>
                      <button
                        onClick={() => deleteRow(ri)}
                        className="text-text-muted hover:text-rose-400 p-0.5"
                        title={`Hapus baris ${ri + 1}`}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border/40 p-0">
                      <input
                        type="text"
                        value={cell}
                        onChange={e => cellChange(ri, ci, e.target.value)}
                        className="w-full bg-transparent border-none outline-none p-2.5 text-xs font-mono text-text-primary focus:bg-cyan-500/10"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-base text-text-primary">Tabel Cepat</h3>
          <p className="text-xs text-text-muted">Spreadsheet mini untuk data harga, kalkulasi, atau inventaris.</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-xs md:text-sm shadow-lg shadow-cyan-500/20"
        >
          <Plus size={16} /> Tabel Baru
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-surface border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sheets.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Table2 size={32} />
          </div>
          <h3 className="font-bold text-base text-text-primary">Belum ada tabel</h3>
          <p className="text-xs text-text-muted max-w-sm">
            Buat tabel sederhana seperti Excel untuk mencatat data apapun dengan ekspor CSV.
          </p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400"
          >
            Buat Tabel Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sheets.map(s => (
            <div
              key={s.id}
              onClick={() => openSheet(s)}
              className="group relative bg-surface hover:bg-surface/80 border border-border hover:border-cyan-500/40 rounded-2xl p-4.5 cursor-pointer transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 size={16} className="text-cyan-400" />
                  <span className="font-bold text-sm text-text-primary">{s.title}</span>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDelete(s.id);
                  }}
                  className="p-1 text-text-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="text-[11px] text-text-muted mt-4">
                Terakhir diperbarui: {s.updated_at}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
