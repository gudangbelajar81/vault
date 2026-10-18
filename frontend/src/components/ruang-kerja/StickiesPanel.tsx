import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Plus, Trash2, Search, Move } from 'lucide-react';
import { wsStorage, type StickyItem } from '../../services/workspaceStorage';
import toast from 'react-hot-toast';

const STICKY_COLORS = ['#ffea00', '#ff6b6b', '#51cf66', '#339af0', '#cc5de8', '#ff922b'];
const STICKY_WIDTH = 220;
const STICKY_HEIGHT = 190;
const BOARD_WIDTH = 2400;
const BOARD_HEIGHT = 1400;

export const StickiesPanel: React.FC = () => {
  const [stickies, setStickies] = useState<StickyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const timerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const boardRef = useRef<HTMLDivElement>(null);

  // ===== Free-Drag Board (Tier 2 Fitur C) =====
  // Aktifkan pos_x/pos_y yang sudah ada di schema tapi dulu tidak dipakai di UI.
  const draggingIdRef = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const load = async () => {
    try {
      const data = await wsStorage.getStickies();
      // Migrasi: sticky lama yang pos_x/pos_y masih 0,0 disebar otomatis
      // supaya tidak numpuk persis di pojok kiri atas papan.
      let needsLayout = false;
      const laidOut = data.map((s, i) => {
        if (s.pos_x === 0 && s.pos_y === 0 && i > 0) {
          needsLayout = true;
          const col = i % 5;
          const row = Math.floor(i / 5);
          return { ...s, pos_x: 24 + col * (STICKY_WIDTH + 20), pos_y: 24 + row * (STICKY_HEIGHT + 20) };
        }
        return s;
      });
      setStickies(laidOut);
      if (needsLayout) {
        for (const s of laidOut) {
          await wsStorage.saveSticky({ id: s.id, content: s.content, color: s.color, pos_x: s.pos_x, pos_y: s.pos_y });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const randomColor = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
    // Taruh sticky baru di posisi acak dalam viewport papan yang terlihat agar mudah ditemukan
    const pos_x = 40 + Math.floor(Math.random() * 300);
    const pos_y = 40 + Math.floor(Math.random() * 200);
    const newItem = await wsStorage.saveSticky({ color: randomColor, content: '', pos_x, pos_y });
    setStickies(prev => [newItem, ...prev]);
    toast.success('Catatan tempel baru dibuat. Seret untuk memindahkan!');
  };

  const handleContentChange = (id: number, content: string) => {
    setStickies(prev => prev.map(s => s.id === id ? { ...s, content } : s));
    if (timerRef.current[id]) clearTimeout(timerRef.current[id]);
    timerRef.current[id] = setTimeout(async () => {
      const target = stickies.find(s => s.id === id);
      await wsStorage.saveSticky({ id, content, color: target?.color || '#ffea00', pos_x: target?.pos_x, pos_y: target?.pos_y });
    }, 600);
  };

  const handleColorChange = async (id: number, color: string) => {
    setStickies(prev => prev.map(s => s.id === id ? { ...s, color } : s));
    const target = stickies.find(s => s.id === id);
    if (target) {
      await wsStorage.saveSticky({ id, content: target.content, color, pos_x: target.pos_x, pos_y: target.pos_y });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Hapus catatan tempel ini?')) return;
    await wsStorage.deleteSticky(id);
    setStickies(prev => prev.filter(s => s.id !== id));
    toast.success('Tempelan dihapus');
  };

  // ===== Drag handlers =====
  const startDrag = (e: React.PointerEvent, s: StickyItem) => {
    // Hindari drag ikut terpicu saat klik di textarea/tombol warna/hapus
    const target = e.target as HTMLElement;
    if (target.closest('textarea') || target.closest('button')) return;

    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    draggingIdRef.current = s.id;
    setDraggingId(s.id);
    dragOffsetRef.current = {
      x: e.clientX - boardRect.left - s.pos_x,
      y: e.clientY - boardRect.top - s.pos_y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onDrag = (e: React.PointerEvent) => {
    const id = draggingIdRef.current;
    if (id === null) return;
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;

    let newX = e.clientX - boardRect.left - dragOffsetRef.current.x;
    let newY = e.clientY - boardRect.top - dragOffsetRef.current.y;
    newX = Math.max(0, Math.min(newX, BOARD_WIDTH - STICKY_WIDTH));
    newY = Math.max(0, Math.min(newY, BOARD_HEIGHT - STICKY_HEIGHT));

    setStickies(prev => prev.map(s => s.id === id ? { ...s, pos_x: newX, pos_y: newY } : s));
  };

  const endDrag = async () => {
    const id = draggingIdRef.current;
    if (id === null) return;
    draggingIdRef.current = null;
    setDraggingId(null);
    const target = stickies.find(s => s.id === id);
    if (target) {
      await wsStorage.saveSticky({ id, content: target.content, color: target.color, pos_x: target.pos_x, pos_y: target.pos_y });
    }
  };

  const filteredStickies = stickies.filter(s =>
    !query || s.content.toLowerCase().includes(query.toLowerCase())
  );
  const isSearchMode = query.trim().length > 0;

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

        <div className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-xl text-[11px] text-text-muted shrink-0">
          <Move size={13} className="text-amber-400" /> Seret kartu untuk atur posisi bebas
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs md:text-sm shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
        >
          <Plus size={16} /> Tempel Baru
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 bg-surface border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : stickies.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <StickyNote size={32} />
          </div>
          <h3 className="font-bold text-base text-text-primary">Belum ada catatan tempel</h3>
          <p className="text-xs text-text-muted max-w-sm">
            Tulis memo kilat, to-do, atau pengingat cepat dengan kartu warna-warni yang bisa diseret bebas.
          </p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all"
          >
            Buat Tempelan Pertama
          </button>
        </div>
      ) : isSearchMode ? (
        /* Mode pencarian: tampilkan sebagai grid rapi biar mudah dibaca, bukan papan bebas */
        filteredStickies.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-8 text-center text-xs text-text-muted">
            Tidak ada tempelan yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredStickies.map(s => (
              <div
                key={s.id}
                style={{ backgroundColor: s.color + '15', borderColor: s.color + '40', boxShadow: `0 6px 24px ${s.color}15` }}
                className="group relative flex flex-col min-h-[190px] border-2 rounded-2xl p-4 transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1">
                    {STICKY_COLORS.map(c => (
                      <button key={c} onClick={() => handleColorChange(s.id, c)} style={{ backgroundColor: c }}
                        className={`w-3.5 h-3.5 rounded-full transition-transform ${s.color === c ? 'scale-125 ring-1 ring-white' : 'opacity-60 hover:opacity-100'}`} />
                    ))}
                  </div>
                  <button onClick={() => handleDelete(s.id)} style={{ color: s.color }} className="p-1 rounded-lg hover:bg-white/10 opacity-60 group-hover:opacity-100 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
                <textarea
                  value={s.content}
                  onChange={e => handleContentChange(s.id, e.target.value)}
                  placeholder="Tulis catatan tempel di sini..."
                  className="flex-1 bg-transparent border-none outline-none resize-none text-xs md:text-sm text-text-primary leading-relaxed placeholder:text-text-muted/60"
                />
              </div>
            ))}
          </div>
        )
      ) : (
        /* Mode normal: Papan Virtual Free-Drag (ala Miro light) */
        <div
          ref={boardRef}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          className="relative bg-surface/40 border border-border rounded-2xl overflow-auto"
          style={{
            height: 'calc(100vh - 260px)',
            backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div style={{ position: 'relative', width: BOARD_WIDTH, height: BOARD_HEIGHT }}>
            {stickies.map(s => (
              <div
                key={s.id}
                onPointerDown={(e) => startDrag(e, s)}
                style={{
                  position: 'absolute',
                  left: s.pos_x,
                  top: s.pos_y,
                  width: STICKY_WIDTH,
                  backgroundColor: s.color + '20',
                  borderColor: s.color + '50',
                  boxShadow: draggingId === s.id ? `0 12px 32px ${s.color}40` : `0 6px 24px ${s.color}15`,
                  zIndex: draggingId === s.id ? 50 : 1,
                  cursor: draggingId === s.id ? 'grabbing' : 'grab',
                }}
                className="group flex flex-col min-h-[190px] border-2 rounded-2xl p-4 transition-shadow duration-150 select-none"
              >
                {/* Top controls: Color dots + Delete + Drag handle */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1">
                    <Move size={12} className="text-text-muted/50 mr-1" />
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
                  onPointerDown={(e) => e.stopPropagation()}
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
        </div>
      )}
    </div>
  );
};
