import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Plus, Trash2, Search } from 'lucide-react';
import { wsStorage, type StickyItem } from '../../services/workspaceStorage';
import toast from 'react-hot-toast';

const STICKY_COLORS = ['#ffea00', '#ff6b6b', '#51cf66', '#339af0', '#cc5de8', '#ff922b'];

export const StickiesPanel: React.FC = () => {
  const [stickies, setStickies] = useState<StickyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const timerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const load = async () => {
    try {
      const data = await wsStorage.getStickies();
      setStickies(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const randomColor = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
    const newItem = await wsStorage.saveSticky({ color: randomColor, content: '' });
    setStickies(prev => [newItem, ...prev]);
    toast.success('Catatan tempel baru dibuat');
  };

  const handleContentChange = (id: number, content: string) => {
    setStickies(prev => prev.map(s => s.id === id ? { ...s, content } : s));
    if (timerRef.current[id]) clearTimeout(timerRef.current[id]);
    timerRef.current[id] = setTimeout(async () => {
      await wsStorage.saveSticky({ id, content, color: stickies.find(s => s.id === id)?.color || '#ffea00' });
    }, 600);
  };

  const handleColorChange = async (id: number, color: string) => {
    setStickies(prev => prev.map(s => s.id === id ? { ...s, color } : s));
    const target = stickies.find(s => s.id === id);
    if (target) {
      await wsStorage.saveSticky({ id, content: target.content, color });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Hapus catatan tempel ini?')) return;
    await wsStorage.deleteSticky(id);
    setStickies(prev => prev.filter(s => s.id !== id));
    toast.success('Tempelan dihapus');
  };

  const filteredStickies = stickies.filter(s =>
    !query || s.content.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 bg-surface border border-border rounded-xl">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari dalam catatan tempel..."
            className="bg-transparent border-none outline-none text-text-primary text-xs md:text-sm w-full placeholder:text-text-muted"
          />
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs md:text-sm shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
        >
          <Plus size={16} /> Tempel Baru
        </button>
      </div>

      {/* Grid of Stickies */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 bg-surface border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredStickies.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <StickyNote size={32} />
          </div>
          <h3 className="font-bold text-base text-text-primary">Belum ada catatan tempel</h3>
          <p className="text-xs text-text-muted max-w-sm">
            Tulis memo kilat, to-do, atau pengingat cepat dengan kartu warna-warni yang selalu tersimpan.
          </p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all"
          >
            Buat Tempelan Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredStickies.map(s => (
            <div
              key={s.id}
              style={{
                backgroundColor: s.color + '15',
                borderColor: s.color + '40',
                boxShadow: `0 6px 24px ${s.color}15`
              }}
              className="group relative flex flex-col min-h-[190px] border-2 rounded-2xl p-4 transition-all duration-200"
            >
              {/* Top controls: Color dots + Delete */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className="flex items-center gap-1">
                  {STICKY_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => handleColorChange(s.id, c)}
                      style={{ backgroundColor: c }}
                      className={`w-3.5 h-3.5 rounded-full transition-transform ${
                        s.color === c ? 'scale-125 ring-1 ring-white' : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => handleDelete(s.id)}
                  style={{ color: s.color }}
                  className="p-1 rounded-lg hover:bg-white/10 opacity-60 group-hover:opacity-100 transition-all"
                  title="Hapus tempelan"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                value={s.content}
                onChange={e => handleContentChange(s.id, e.target.value)}
                placeholder="Tulis catatan tempel di sini..."
                className="flex-1 bg-transparent border-none outline-none resize-none text-xs md:text-sm text-text-primary leading-relaxed placeholder:text-text-muted/60"
              />

              {/* Timestamp */}
              <div className="text-[10px] text-text-muted/70 pt-2 border-t border-white/5 flex justify-between items-center">
                <span>{s.created_at}</span>
                <span className="text-[9px] uppercase tracking-wider opacity-60">Auto-Save</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
