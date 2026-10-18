import React, { useState, useEffect } from 'react';
import { Bookmark, Plus, Trash2, Search, Copy, ExternalLink, Globe, Pencil, X, Check } from 'lucide-react';
import { wsStorage, type BookmarkItem } from '../../services/workspaceStorage';
import toast from 'react-hot-toast';

export const BookmarksPanel: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newNote, setNewNote] = useState('');
  const [query, setQuery] = useState('');

  // State untuk mode edit inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');

  const load = async () => {
    try {
      const data = await wsStorage.getBookmarks();
      setBookmarks(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!newUrl.trim()) {
      toast.error('URL wajib diisi');
      return;
    }
    const fullUrl = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    await wsStorage.saveBookmark({ url: fullUrl, title: newTitle, note: newNote });
    setNewUrl('');
    setNewTitle('');
    setNewNote('');
    await load();
    toast.success('Bookmark berhasil disimpan');
  };

  const handleDelete = async (id: number) => {
    await wsStorage.deleteBookmark(id);
    load();
    toast.success('Bookmark dihapus');
  };

  const startEdit = (b: BookmarkItem) => {
    setEditingId(b.id);
    setEditUrl(b.url);
    setEditTitle(b.title);
    setEditNote(b.note);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditUrl('');
    setEditTitle('');
    setEditNote('');
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    if (!editUrl.trim()) {
      toast.error('URL wajib diisi');
      return;
    }
    const fullUrl = editUrl.startsWith('http') ? editUrl : `https://${editUrl}`;
    const result = await wsStorage.updateBookmark(editingId, { url: fullUrl, title: editTitle, note: editNote });
    if (!result) {
      toast.error('Bookmark tidak ditemukan');
      return;
    }
    cancelEdit();
    await load();
    toast.success('Bookmark berhasil diperbarui');
  };

  const filteredBookmarks = bookmarks.filter(b =>
    !query ||
    b.url.toLowerCase().includes(query.toLowerCase()) ||
    b.title.toLowerCase().includes(query.toLowerCase()) ||
    b.note.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Form Input Card */}
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
        <h4 className="font-bold text-xs uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <Bookmark size={14} /> Tambah Bookmark Baru
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Judul / Label (misal: Cloudflare DNS)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="px-3.5 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
          />
          <input
            type="text"
            placeholder="https://dash.cloudflare.com..."
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            className="px-3.5 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
          />
          <button
            onClick={handleAdd}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-cyan-500 text-black font-bold text-xs rounded-xl hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
          >
            <Plus size={14} /> Simpan Bookmark
          </button>
        </div>
        <input
          type="text"
          placeholder="Catatan konteks: Login pakai akun email apa, untuk project apa..."
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          className="w-full px-3.5 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
        />
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface border border-border rounded-xl">
        <Search size={16} className="text-text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Cari bookmark atau catatan konteks..."
          className="bg-transparent border-none outline-none text-text-primary text-xs md:text-sm w-full placeholder:text-text-muted"
        />
      </div>

      {/* Bookmark Cards List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-surface border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredBookmarks.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center text-xs text-text-muted">
          Belum ada bookmark tersimpan.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBookmarks.map(b => (
            editingId === b.id ? (
              /* ===== Mode Edit Inline ===== */
              <div
                key={b.id}
                className="bg-surface border border-cyan-500/40 rounded-xl p-3 space-y-2"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Judul / Label"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="px-3.5 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
                  />
                  <input
                    type="text"
                    placeholder="https://..."
                    value={editUrl}
                    onChange={e => setEditUrl(e.target.value)}
                    className="px-3.5 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Catatan konteks..."
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  className="w-full px-3.5 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-white/5 text-xs"
                  >
                    <X size={13} /> Batal
                  </button>
                  <button
                    onClick={saveEdit}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400"
                  >
                    <Check size={13} /> Simpan
                  </button>
                </div>
              </div>
            ) : (
              /* ===== Mode Tampilan Normal ===== */
              <div
                key={b.id}
                className="bg-surface border border-border rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-cyan-500/30 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-cyan-400 shrink-0" />
                    <span className="font-bold text-xs md:text-sm text-text-primary truncate">
                      {b.title || b.url}
                    </span>
                  </div>
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-400/80 hover:underline flex items-center gap-1 mt-1 truncate"
                  >
                    {b.url} <ExternalLink size={10} />
                  </a>
                  {b.note && (
                    <div className="text-[11px] text-text-muted mt-1 italic">
                      📝 {b.note}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(b.url);
                      toast.success('URL disalin ke clipboard');
                    }}
                    className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-white/5 text-xs flex items-center gap-1"
                    title="Salin URL"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={() => startEdit(b)}
                    className="p-1.5 rounded-lg border border-border text-text-muted hover:text-cyan-400 hover:bg-cyan-500/10 text-xs"
                    title="Edit Bookmark"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="p-1.5 rounded-lg border border-border text-text-muted hover:text-rose-400 hover:bg-rose-500/10 text-xs"
                    title="Hapus Bookmark"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
};
