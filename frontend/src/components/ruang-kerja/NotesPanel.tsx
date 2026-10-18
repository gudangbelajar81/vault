import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, Search, Pin, Trash2, Clock, BookOpen,
  ChevronRight, Sparkles, BookMarked, Folder, FolderPlus,
  FolderOpen, Check, X, Layers, Palette
} from 'lucide-react';
import { wsStorage, type Note, type SearchResultItem } from '../../services/workspaceStorage';
import { NoteEditor } from './NoteEditor';
import toast from 'react-hot-toast';

const COVER_COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#facc15', '#60a5fa', '#f87171'];

/** Highlight semua kemunculan `keyword` di dalam `text` dengan warna neon kuning. */
const highlightText = (text: string, keyword: string): React.ReactNode => {
  if (!keyword.trim()) return text;
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-amber-400/30 text-amber-200 rounded px-0.5 font-semibold not-italic"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const NotesPanel: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [query, setQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Folder hierarchy state
  const [activeFolder, setActiveFolder] = useState<string | 'all' | 'none'>('all');
  const [folderCreating, setFolderCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [moveTarget, setMoveTarget] = useState<Note | null>(null);
  const [moveFolderName, setMoveFolderName] = useState('');
  // Book cover color picker state
  const [colorTarget, setColorTarget] = useState<Note | null>(null);


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
    const folder = activeFolder === 'all' || activeFolder === 'none' ? null : activeFolder;
    const newNote = await wsStorage.saveNote({ title: 'Buku Catatan Baru', folder });
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

  // Unique folder list derived from notes
  const folderList = Array.from(
    new Set(notes.map(n => n.folder).filter((f): f is string => !!f && f.trim().length > 0))
  ).sort((a, b) => a.localeCompare(b, 'id'));

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return toast.error('Nama folder tidak boleh kosong');
    if (folderList.some(f => f.toLowerCase() === name.toLowerCase())) {
      return toast.error('Folder dengan nama itu sudah ada');
    }
    setFolderCreating(false);
    setNewFolderName('');
    setActiveFolder(name);
    toast.success(`Folder "${name}" dibuat. Pilih buku lalu pindahkan ke folder ini.`);
  };

  const handleMoveToFolder = async (note: Note, folder: string | null) => {
    const updates: Partial<Note> & { title: string } = { id: note.id, title: note.title, folder };
    await wsStorage.saveNote(updates);
    setMoveTarget(null);
    setMoveFolderName('');
    await load();
    toast.success(folder ? `Buku dipindah ke "${folder}"` : 'Buku dipindah ke Tanpa Folder');
  };

  const handleSetCoverColor = async (note: Note, color: string | null) => {
    const updates: Partial<Note> & { title: string } = { id: note.id, title: note.title, cover_color: color || undefined };
    await wsStorage.saveNote(updates);
    setColorTarget(null);
    await load();
    toast.success('Warna sampul buku diperbarui');
  };


  const openFromSearchResult = (noteId: number) => {
    const target = notes.find(n => n.id === noteId);
    if (target) {
      setActiveNote(target);
      setQuery('');
    }
  };

  const filteredNotes = notes.filter(n => {
    // Folder filter
    if (activeFolder === 'none') {
      if (n.folder) return false;
    } else if (activeFolder !== 'all') {
      if (n.folder !== activeFolder) return false;
    }
    // Text query filter
    if (!query) return true;
    return (
      n.title.toLowerCase().includes(query.toLowerCase()) ||
      (n.content && n.content.toLowerCase().includes(query.toLowerCase()))
    );
  });

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

      {/* Folder hierarchy bar */}
      <div className="bg-surface border border-border rounded-2xl p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-text-muted">
            <Layers size={13} className="text-cyan-400" /> Folder Buku
          </div>
          <button
            onClick={() => { setFolderCreating(v => !v); setNewFolderName(''); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold hover:bg-cyan-500/20 transition-all"
          >
            <FolderPlus size={13} /> Folder Baru
          </button>
        </div>

        {folderCreating && (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setFolderCreating(false); }}
              placeholder="Nama folder..."
              className="flex-1 px-3 py-2 bg-black/20 border border-border rounded-lg text-xs text-text-primary outline-none focus:border-cyan-500/50"
            />
            <button onClick={handleCreateFolder} className="p-2 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 transition-all" title="Simpan folder">
              <Check size={14} />
            </button>
            <button onClick={() => setFolderCreating(false)} className="p-2 rounded-lg bg-black/20 text-text-muted hover:text-text-primary transition-all" title="Batal">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveFolder('all')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
              activeFolder === 'all'
                ? 'bg-cyan-500 text-black border-cyan-500'
                : 'bg-black/20 text-text-muted border-border hover:text-text-primary'
            }`}
          >
            Semua ({notes.length})
          </button>
          <button
            onClick={() => setActiveFolder('none')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
              activeFolder === 'none'
                ? 'bg-cyan-500 text-black border-cyan-500'
                : 'bg-black/20 text-text-muted border-border hover:text-text-primary'
            }`}
          >
            Tanpa Folder ({notes.filter(n => !n.folder).length})
          </button>
          {folderList.map(f => {
            const count = notes.filter(n => n.folder === f).length;
            const isActive = activeFolder === f;
            return (
              <button
                key={f}
                onClick={() => setActiveFolder(f)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  isActive
                    ? 'bg-cyan-500 text-black border-cyan-500'
                    : 'bg-black/20 text-text-muted border-border hover:text-text-primary'
                }`}
              >
                <Folder size={12} className={isActive ? 'text-black' : 'text-cyan-400'} />
                {f} ({count})
              </button>
            );
          })}
        </div>
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
              {globalResults.map(r => {
                const plainText = r.content.replace(/<[^>]*>/g, '').slice(0, 200);
                return (
                  <div
                    key={r.id}
                    onClick={() => openFromSearchResult(r.note_id)}
                    className="p-3 bg-black/20 hover:bg-black/40 border border-border hover:border-amber-500/30 rounded-xl cursor-pointer transition-all space-y-1"
                  >
                    <div className="flex items-center gap-1.5 text-xs flex-wrap">
                      <BookOpen size={13} className="text-cyan-400 shrink-0" />
                      <span className="font-bold text-cyan-400 truncate">
                        {highlightText(r.note_title, query)}
                      </span>
                      <ChevronRight size={11} className="text-text-muted shrink-0" />
                      <span className="text-text-primary truncate">
                        {highlightText(r.page_title, query)}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted line-clamp-3 leading-relaxed">
                      {highlightText(plainText, query)}
                    </div>
                  </div>
                );
              })}
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

                {n.folder ? (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold mb-2">
                    <FolderOpen size={11} /> {n.folder}
                  </div>
                ) : null}

                <p className="text-xs text-text-muted line-clamp-3 leading-relaxed">
                  {n.content ? n.content.replace(/<[^>]*>/g, '').slice(0, 160) : 'Buku catatan multi-halaman...'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/60 text-[11px] text-text-muted">
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {n.updated_at}
                </span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMoveTarget(n);
                      setMoveFolderName(n.folder || '');
                    }}
                    className="p-1 text-text-muted hover:text-cyan-400 transition-colors"
                    title="Pindah ke folder"
                  >
                    <Folder size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(n.id);
                    }}
                    className="p-1 text-text-muted hover:text-rose-400 transition-colors"
                    title="Hapus buku catatan"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Move to folder modal */}
      {moveTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setMoveTarget(null)}
        >
          <div
            className="w-full max-w-sm bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <FolderOpen size={18} className="text-cyan-400" />
              <h3 className="font-bold text-sm text-text-primary">Pindah Buku ke Folder</h3>
            </div>

            <p className="text-xs text-text-muted">
              Buku: <span className="text-text-primary font-bold">{moveTarget.title}</span>
            </p>

            <div className="space-y-1.5">
              <button
                onClick={() => handleMoveToFolder(moveTarget, null)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-border text-xs text-text-muted hover:text-text-primary hover:border-cyan-500/40 transition-all"
              >
                <X size={13} /> Tanpa Folder
              </button>
              {folderList.map(f => (
                <button
                  key={f}
                  onClick={() => handleMoveToFolder(moveTarget, f)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-border text-xs text-text-primary hover:border-cyan-500/40 transition-all"
                >
                  <Folder size={13} className="text-cyan-400" /> {f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={moveFolderName}
                onChange={e => setMoveFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && moveFolderName.trim()) handleMoveToFolder(moveTarget, moveFolderName.trim()); }}
                placeholder="Atau ketik nama folder baru..."
                className="flex-1 px-3 py-2 bg-black/20 border border-border rounded-lg text-xs text-text-primary outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={() => moveFolderName.trim() && handleMoveToFolder(moveTarget, moveFolderName.trim())}
                className="p-2 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 transition-all"
                title="Pindah ke folder baru"
              >
                <Check size={14} />
              </button>
            </div>

            <button
              onClick={() => setMoveTarget(null)}
              className="w-full py-2 rounded-lg border border-border text-xs text-text-muted hover:text-text-primary transition-all"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
