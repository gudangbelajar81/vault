import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, Search, Pin, Trash2, Clock, BookOpen,
  ChevronRight, Sparkles, BookMarked
} from 'lucide-react';
import { wsStorage, type Note, type SearchResultItem } from '../../services/workspaceStorage';
import { NoteEditor } from './NoteEditor';
import toast from 'react-hot-toast';

export const NotesPanel: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [query, setQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    try {
      const data = await wsStorage.getNotes();
      setNotes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Full-text search across all note pages
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) {
      setGlobalResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const res = await wsStorage.searchPages(query);
      setGlobalResults(res);
      setSearching(false);
    }, 350);
  }, [query]);

  const handleCreate = async () => {
    const newNote = await wsStorage.saveNote({ title: 'Buku Catatan Baru' });
    // Also create initial page
    await wsStorage.addPage(newNote.id, 'Halaman 1', '');
    await load();
    setActiveNote(newNote);
    toast.success('Buku Catatan baru berhasil dibuat!');
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus seluruh buku catatan ini beserta semua halamannya?')) return;
    await wsStorage.deleteNote(id);
    if (activeNote?.id === id) setActiveNote(null);
    load();
    toast.success('Buku catatan dihapus');
  };

  const openFromSearchResult = (noteId: number) => {
    const target = notes.find(n => n.id === noteId);
    if (target) {
      setActiveNote(target);
      setQuery('');
    }
  };

  const filteredNotes = notes.filter(n =>
    !query ||
    n.title.toLowerCase().includes(query.toLowerCase()) ||
    (n.content && n.content.toLowerCase().includes(query.toLowerCase()))
  );

  const isGlobalSearchMode = query.trim().length > 0;

  if (activeNote) {
    return (
      <NoteEditor
        note={activeNote}
        onBack={() => {
          setActiveNote(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top action bar: Search & Add */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 bg-surface border border-border rounded-xl">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari buku atau cari teks di dalam SEMUA halaman..."
            className="bg-transparent border-none outline-none text-text-primary text-xs md:text-sm w-full placeholder:text-text-muted"
          />
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-xs md:text-sm shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
        >
          <Plus size={16} /> Catatan Baru
        </button>
      </div>

      {/* Global search result banner */}
      {isGlobalSearchMode && (
        <div className="bg-surface border border-border rounded-2xl p-3.5 space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Search size={13} /> Hasil Pencarian di Dalam Seluruh Halaman {searching && '(mencari...)'}
          </div>

          {globalResults.length === 0 ? (
            <div className="text-xs text-text-muted py-2">
              {searching ? 'Mencari kecocokan teks...' : 'Tidak ditemukan kecocokan teks di dalam isi halaman.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {globalResults.map(r => (
                <div
                  key={r.id}
                  onClick={() => openFromSearchResult(r.note_id)}
                  className="p-3 bg-black/20 hover:bg-black/40 border border-border rounded-xl cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <BookOpen size={13} className="text-cyan-400" />
                    <span className="font-bold text-cyan-400 truncate">{r.note_title}</span>
                    <ChevronRight size={11} className="text-text-muted" />
                    <span className="text-text-primary truncate">{r.page_title}</span>
                  </div>
                  <div className="text-[11px] text-text-muted line-clamp-2">
                    {r.content.replace(/<[^>]*>/g, '').slice(0, 140)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 bg-surface border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <FileText size={32} />
          </div>
          <h3 className="font-bold text-base text-text-primary">Belum ada buku catatan</h3>
          <p className="text-xs text-text-muted max-w-sm">
            Klik tombol Catatan Baru untuk mulai menulis buku catatan pintar. Tersimpan otomatis di perangkat Anda.
          </p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 transition-all"
          >
            Buat Catatan Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredNotes.map(n => (
            <div
              key={n.id}
              onClick={() => setActiveNote(n)}
              className="group relative bg-surface hover:bg-surface/80 border border-border hover:border-cyan-500/40 rounded-2xl p-4.5 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-cyan-500/5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookMarked size={16} className="text-cyan-400 shrink-0" />
                    <h4 className="font-bold text-sm text-text-primary truncate">
                      {n.title || 'Tanpa Judul'}
                    </h4>
                  </div>
                  {n.pinned ? <Pin size={13} className="text-amber-400 shrink-0" /> : null}
                </div>

                <p className="text-xs text-text-muted line-clamp-3 leading-relaxed">
                  {n.content ? n.content.replace(/<[^>]*>/g, '').slice(0, 160) : 'Buku catatan multi-halaman...'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/60 text-[11px] text-text-muted">
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {n.updated_at}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(n.id);
                  }}
                  className="p-1 text-text-muted hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Hapus buku catatan"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
