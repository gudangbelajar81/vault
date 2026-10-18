import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Plus, Trash2, Pin, PinOff, Tag, Clock, Download,
  Columns2, SplitSquareHorizontal, Lock, Unlock, History, X,
  Search, BookOpen, ChevronRight, FileText, Printer, Check, Loader2, FileStack
} from 'lucide-react';
import { wsStorage, type Note, type NotePage, type PageHistoryItem } from '../../services/workspaceStorage';
import { RichEditor } from './RichEditor';
import toast from 'react-hot-toast';
// @ts-ignore - html2pdf.js tidak menyediakan type declaration resmi
import html2pdf from 'html2pdf.js';

// Hash page-lock password with SHA-256 + random salt (never store plaintext)
const bufferToHex = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

const hashPassword = async (password: string, saltHex: string): Promise<string> => {
  const enc = new TextEncoder();
  const data = enc.encode(`${saltHex}:${password}`);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return bufferToHex(digest);
};

const newSalt = (): string => {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return bufferToHex(bytes.buffer);
};

interface NoteEditorProps {
  note: Note;
  onBack: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onBack }) => {
  const [title, setTitle] = useState(note.title);
  const [pages, setPages] = useState<NotePage[]>([]);
  const [activePageId, setActivePageId] = useState<number | null>(null);
  const [saved, setSaved] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pageQuery, setPageQuery] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<PageHistoryItem[]>([]);
  const [splitMode, setSplitMode] = useState(false);
  const [secondPageId, setSecondPageId] = useState<number | null>(null);
  const [isExportingBundle, setIsExportingBundle] = useState(false);

  // Password lock state
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [unlockedPages, setUnlockedPages] = useState<Record<number, boolean>>({});
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('');

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageContentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageTitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const secondPageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPages = async (targetActiveId?: number) => {
    try {
      const data = await wsStorage.getPages(note.id);
      setPages(data);
      if (data.length > 0) {
        setActivePageId(prev => {
          if (targetActiveId && data.some(p => p.id === targetActiveId)) return targetActiveId;
          if (prev && data.some(p => p.id === prev)) return prev;
          return data[0].id;
        });
      } else {
        const newP = await wsStorage.addPage(note.id, 'Halaman 1', '');
        setPages([newP]);
        setActivePageId(newP.id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (pageContentTimerRef.current) clearTimeout(pageContentTimerRef.current);
      if (pageTitleTimerRef.current) clearTimeout(pageTitleTimerRef.current);
      if (secondPageTimerRef.current) clearTimeout(secondPageTimerRef.current);
    };
  }, [note.id]);

  const activePage = pages.find(p => p.id === activePageId);
  const secondPage = splitMode && secondPageId ? pages.find(p => p.id === secondPageId) : null;

  // Auto-save note title
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setSaved(false);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(async () => {
      await wsStorage.saveNote({ ...note, title: newTitle });
      setSaved(true);
    }, 800);
  };

  // Add new page
  const handleAddPage = async () => {
    const pageNum = pages.length + 1;
    const newP = await wsStorage.addPage(note.id, `Halaman ${pageNum}`, '');
    setPages(prev => [...prev, newP]);
    setActivePageId(newP.id);
    toast.success('Halaman baru ditambahkan');
  };

  // Delete page
  const handleDeletePage = async (pageId: number) => {
    if (pages.length <= 1) {
      toast.error('Buku harus memiliki minimal 1 halaman');
      return;
    }
    if (!window.confirm('Hapus halaman ini beserta isinya?')) return;
    await wsStorage.deletePage(pageId);
    const remaining = pages.filter(p => p.id !== pageId);
    setPages(remaining);
    if (activePageId === pageId) {
      setActivePageId(remaining[0].id);
    }
    toast.success('Halaman dihapus');
  };

  // Save page content changes
  const handlePageContentChange = (content: string) => {
    if (!activePage) return;
    const pid = activePage.id;
    setPages(prev => prev.map(p => p.id === pid ? { ...p, content } : p));
    setSaved(false);
    if (pageContentTimerRef.current) clearTimeout(pageContentTimerRef.current);
    pageContentTimerRef.current = setTimeout(async () => {
      await wsStorage.updatePage(pid, { content });
      setSaved(true);
    }, 1000);
  };

  // Save active page title change
  const handlePageTitleChange = (newPageTitle: string) => {
    if (!activePage) return;
    const pid = activePage.id;
    setPages(prev => prev.map(p => p.id === pid ? { ...p, page_title: newPageTitle } : p));
    setSaved(false);
    if (pageTitleTimerRef.current) clearTimeout(pageTitleTimerRef.current);
    pageTitleTimerRef.current = setTimeout(async () => {
      await wsStorage.updatePage(pid, { page_title: newPageTitle });
      setSaved(true);
    }, 800);
  };

  // Save second page content in split mode
  const handleSecondPageContentChange = (content: string) => {
    if (!secondPage) return;
    const pid = secondPage.id;
    setPages(prev => prev.map(p => p.id === pid ? { ...p, content } : p));
    setSaved(false);
    if (secondPageTimerRef.current) clearTimeout(secondPageTimerRef.current);
    secondPageTimerRef.current = setTimeout(async () => {
      await wsStorage.updatePage(pid, { content });
      setSaved(true);
    }, 1000);
  };

  // Tags
  const currentTags = (activePage?.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const addTag = () => {
    if (!tagInput.trim() || !activePage) return;
    const nextTags = Array.from(new Set([...currentTags, tagInput.trim()])).join(',');
    wsStorage.updatePage(activePage.id, { tags: nextTags });
    setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, tags: nextTags } : p));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    if (!activePage) return;
    const nextTags = currentTags.filter(t => t !== tag).join(',');
    wsStorage.updatePage(activePage.id, { tags: nextTags });
    setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, tags: nextTags } : p));
  };

  // Pin page
  const togglePin = async () => {
    if (!activePage) return;
    const newPinned = activePage.pinned ? 0 : 1;
    await wsStorage.updatePage(activePage.id, { pinned: newPinned });
    setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, pinned: newPinned } : p));
    toast.success(newPinned ? 'Halaman disematkan' : 'Pin dilepas');
  };

  // Cover Color
  const setCoverColor = async (color: string) => {
    if (!activePage) return;
    await wsStorage.updatePage(activePage.id, { cover_color: color });
    setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, cover_color: color } : p));
  };

  // Version History
  const openHistoryModal = async () => {
    if (!activePage) return;
    const list = await wsStorage.getPageHistory(activePage.id);
    setHistory(list);
    setShowHistory(true);
  };

  const restoreHistory = async (hist: PageHistoryItem) => {
    if (!activePage) return;
    if (window.confirm('Kembalikan ke versi ini? Isi sekarang akan disimpan sebagai riwayat baru.')) {
      await wsStorage.updatePage(activePage.id, { content: hist.content });
      setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, content: hist.content } : p));
      setShowHistory(false);
      toast.success('Halaman berhasil dikembalikan ke versi sebelumnya!');
    }
  };

  // Password Lock
  const handleLockPage = async () => {
    if (!activePage) return;
    if (activePage.locked) {
      // Remove lock
      await wsStorage.updatePage(activePage.id, { locked: 0, passwordHash: '' });
      setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, locked: 0, passwordHash: '' } : p));
      toast.success('Kunci sandi halaman telah dicabut');
    } else {
      if (!lockPassword.trim()) {
        toast.error('Masukkan kata sandi pengunci');
        return;
      }
      const salt = newSalt();
      const hash = await hashPassword(lockPassword, salt);
      const stored = `${salt}:${hash}`;
      await wsStorage.updatePage(activePage.id, { locked: 1, passwordHash: stored });
      setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, locked: 1, passwordHash: stored } : p));
      setUnlockedPages(prev => ({ ...prev, [activePage.id]: true }));
      setShowLockModal(false);
      setLockPassword('');
      toast.success('Halaman berhasil digembok kata sandi');
    }
  };

  const handleUnlockPage = async () => {
    if (!activePage) return;
    const stored = activePage.passwordHash || '';
    const [salt, hash] = stored.split(':');
    if (salt && hash) {
      const attempt = await hashPassword(unlockPasswordInput, salt);
      if (attempt === hash) {
        setUnlockedPages(prev => ({ ...prev, [activePage.id]: true }));
        setUnlockPasswordInput('');
        toast.success('Halaman terbuka');
        return;
      }
    } else if (unlockPasswordInput === activePage.passwordHash) {
      // Legacy plaintext fallback for old locks
      setUnlockedPages(prev => ({ ...prev, [activePage.id]: true }));
      setUnlockPasswordInput('');
      toast.success('Halaman terbuka');
      return;
    }
    toast.error('Kata sandi salah!');
  };

  // Export HTML
  const exportHtml = () => {
    if (!activePage) return;
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>${activePage.page_title || 'Catatan'}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 24px; color: #1e293b; line-height: 1.7; background: #fff; }
  h1 { border-bottom: 2px solid #00f0ff; padding-bottom: 8px; color: #0f172a; }
  img { max-width: 100%; border-radius: 8px; margin: 12px 0; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  table td, table th { border: 1px solid #cbd5e1; padding: 10px; }
  table th { background: #f8fafc; }
  blockquote { border-left: 4px solid #00f0ff; padding-left: 12px; margin: 12px 0; color: #64748b; }
  pre { background: #f1f5f9; padding: 12px; border-radius: 8px; font-family: monospace; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
  .footer { color: #94a3b8; font-size: 12px; text-align: center; }
</style>
</head>
<body>
<h1>${activePage.page_title || 'Tanpa Judul'}</h1>
<div>${activePage.content}</div>
<hr>
<p class="footer">Diekspor dari Ruang Kerja VaultPro pada ${new Date().toLocaleString('id-ID')}</p>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(activePage.page_title || 'catatan').replace(/[^a-z0-9]/gi, '_')}.html`;
    a.click();
  };

  // Export seluruh buku (semua halaman) menjadi 1 file PDF dengan cover + daftar isi
  const exportBookToPdf = async () => {
    if (pages.length === 0) {
      toast.error('Buku ini belum punya halaman untuk diekspor.');
      return;
    }
    setIsExportingBundle(true);
    try {
      const coverColor = note.cover_color || '#00f0ff';
      const sortedPages = [...pages].sort((a, b) => a.sort_order - b.sort_order);

      const tocItems = sortedPages
        .map((p, i) => `<li><span class="toc-num">${i + 1}.</span> ${p.page_title || 'Tanpa Judul'}</li>`)
        .join('');

      const pageSections = sortedPages
        .map((p, i) => {
          const isLocked = p.locked && !unlockedPages[p.id];
          const bodyContent = isLocked
            ? `<p class="locked-notice">🔒 Halaman ini terkunci dengan kata sandi dan tidak disertakan dalam ekspor PDF demi keamanan.</p>`
            : (p.content || '<p><em>(Halaman kosong)</em></p>');
          return `
            <section class="page-section" style="${i > 0 ? 'page-break-before: always;' : ''}">
              <h2>${i + 1}. ${p.page_title || 'Tanpa Judul'}</h2>
              <div class="page-body">${bodyContent}</div>
            </section>
          `;
        })
        .join('');

      const bundleHtml = `
        <div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.7;">
          <style>
            .cover-page { page-break-after: always; min-height: 900px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: linear-gradient(135deg, ${coverColor}22, #ffffff); border-radius: 16px; padding: 40px; }
            .cover-page h1 { font-size: 32px; font-weight: 900; color: #0f172a; margin-bottom: 12px; }
            .cover-page .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; background: ${coverColor}; color: #000; font-weight: 700; font-size: 12px; margin-bottom: 20px; }
            .cover-page .meta { color: #64748b; font-size: 13px; margin-top: 24px; }
            .toc-page { page-break-after: always; padding: 20px; }
            .toc-page h2 { border-bottom: 3px solid ${coverColor}; padding-bottom: 10px; color: #0f172a; }
            .toc-page ul { list-style: none; padding: 0; margin-top: 16px; }
            .toc-page li { padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size: 14px; }
            .toc-num { font-weight: 700; color: ${coverColor}; margin-right: 8px; }
            .page-section { padding: 10px 4px; }
            .page-section h2 { border-bottom: 2px solid ${coverColor}; padding-bottom: 8px; color: #0f172a; font-size: 20px; }
            .page-body img { max-width: 100%; border-radius: 8px; margin: 12px 0; }
            .page-body table { border-collapse: collapse; width: 100%; margin: 16px 0; }
            .page-body table td, .page-body table th { border: 1px solid #cbd5e1; padding: 8px; font-size: 13px; }
            .page-body blockquote { border-left: 4px solid ${coverColor}; padding-left: 12px; color: #64748b; }
            .page-body pre { background: #f1f5f9; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; }
            .locked-notice { color: #f59e0b; font-weight: 600; font-style: italic; }
          </style>

          <div class="cover-page">
            <span class="badge">BUKU CATATAN</span>
            <h1>${note.title || 'Tanpa Judul'}</h1>
            <p style="color:#64748b; font-size:14px;">${sortedPages.length} Halaman</p>
            <p class="meta">Diekspor dari Ruang Kerja VaultPro — ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</p>
          </div>

          <div class="toc-page">
            <h2>📑 Daftar Isi</h2>
            <ul>${tocItems}</ul>
          </div>

          ${pageSections}
        </div>
      `;

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px';
      container.innerHTML = bundleHtml;
      document.body.appendChild(container);

      await html2pdf()
        .set({
          margin: 14,
          filename: `${(note.title || 'buku-catatan').replace(/[^a-z0-9]/gi, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(container)
        .save();

      document.body.removeChild(container);
      toast.success(`PDF buku "${note.title}" berhasil diunduh (${sortedPages.length} halaman)!`);
    } catch (err) {
      console.error('Gagal ekspor PDF bundle:', err);
      toast.error('Gagal membuat PDF bundle. Coba lagi.');
    } finally {
      setIsExportingBundle(false);
    }
  };

  // Export PDF / Print (1 halaman aktif saja — via dialog print browser)
  const exportPdf = () => {
    if (!activePage) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>${activePage.page_title}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #000; line-height: 1.6; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; }
  table td, table th { border: 1px solid #ccc; padding: 8px; }
</style>
</head>
<body>
<h1>${activePage.page_title}</h1>
<div>${activePage.content}</div>
<script>
  window.onload = function() { window.print(); }
</script>
</body>
</html>`);
    printWindow.document.close();
  };

  const filteredPages = pages.filter(p => !pageQuery || p.page_title.toLowerCase().includes(pageQuery.toLowerCase()) || (p.tags && p.tags.toLowerCase().includes(pageQuery.toLowerCase())));

  const isPageLocked = activePage?.locked && !unlockedPages[activePage.id];
  const coverColors = ['#00f0ff', '#51cf66', '#ffea00', '#ff6b6b', '#cc5de8', '#ff922b'];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-3">
      {/* Top Bar Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-border rounded-2xl shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-white/5 border border-border transition-all"
          >
            <ArrowLeft size={14} /> Kembali
          </button>

          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-cyan-400" />
            <input
              type="text"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Judul Buku Catatan..."
              className="bg-transparent border-none text-base md:text-lg font-black text-text-primary outline-none focus:ring-0 w-48 sm:w-64 md:w-80"
            />
          </div>

          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            saved ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10 animate-pulse'
          }`}>
            {saved ? '✓ Tersimpan' : '● Menyimpan...'}
          </span>
        </div>

        {/* Global actions: Split mode, export, history */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSplitMode(!splitMode);
              if (!splitMode && pages.length > 1 && !secondPageId) {
                const other = pages.find(p => p.id !== activePageId);
                if (other) setSecondPageId(other.id);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              splitMode ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-border'
            }`}
            title="Split Screen: Lihat & edit 2 halaman berdampingan"
          >
            <Columns2 size={14} /> <span className="hidden sm:inline">Split Screen</span>
          </button>

          <button
            onClick={openHistoryModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-white/5 border border-border transition-all"
            title="Riwayat Versi Halaman"
          >
            <History size={14} /> <span className="hidden sm:inline">Riwayat</span>
          </button>

          <button
            onClick={exportHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-white/5 border border-border transition-all"
            title="Download file HTML offline"
          >
            <Download size={14} /> <span className="hidden sm:inline">HTML</span>
          </button>

          <button
            onClick={exportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-white/5 border border-border transition-all"
            title="Cetak atau simpan sebagai PDF"
          >
            <Printer size={14} /> <span className="hidden sm:inline">PDF</span>
          </button>

          <button
            onClick={exportBookToPdf}
            disabled={isExportingBundle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-white/5 border border-border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Ekspor seluruh buku (semua halaman) jadi 1 file PDF dengan cover & daftar isi"
          >
            {isExportingBundle ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileStack size={14} />
            )}
            <span className="hidden sm:inline">{isExportingBundle ? 'Memproses...' : 'PDF Buku'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Page Navigator + Center/Right Editor */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {/* Left Sidebar: Pages in this Notebook */}
        <div className="w-64 bg-surface border border-border rounded-2xl flex flex-col shrink-0 overflow-hidden">
          {/* Header & Page Search */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-text-muted tracking-wider">
                Halaman ({pages.length})
              </span>
              <button
                onClick={handleAddPage}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-xs font-bold transition-all"
                title="Tambah Halaman Baru"
              >
                <Plus size={13} /> Baru
              </button>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-black/20 rounded-xl border border-border text-xs">
              <Search size={13} className="text-text-muted" />
              <input
                type="text"
                placeholder="Cari judul/tag..."
                value={pageQuery}
                onChange={e => setPageQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-text-primary text-xs w-full"
              />
            </div>
          </div>

          {/* Page List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredPages.map((p, idx) => {
              const isActive = p.id === activePageId;
              return (
                <div
                  key={p.id}
                  onClick={() => setActivePageId(p.id)}
                  style={{ borderLeftColor: p.cover_color || 'transparent' }}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs border-l-4 transition-all ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-400 font-bold border-cyan-400 shadow-sm'
                      : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {p.locked ? <Lock size={12} className="text-amber-400 shrink-0" /> : <FileText size={12} className="shrink-0" />}
                    <span className="shrink-0 text-[10px] font-black opacity-50 tabular-nums">{idx + 1}.</span>
                    <span className="truncate">{p.page_title || `Halaman ${idx + 1}`}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {p.pinned ? <Pin size={11} className="text-amber-400" /> : null}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePage(p.id);
                      }}
                      className="p-1 text-text-muted hover:text-rose-400"
                      title="Hapus halaman"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Active Page Editor */}
        <div className="flex-1 flex flex-col min-w-0 bg-surface border border-border rounded-2xl overflow-hidden p-4 space-y-3">
          {activePage ? (
            <>
              {/* Active Page Header with Cover, Title, Pin, Lock, and Tags */}
              <div
                style={{ borderTopColor: activePage.cover_color || '#00f0ff' }}
                className="pt-2 border-t-4 space-y-2 shrink-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    type="text"
                    value={activePage.page_title}
                    onChange={e => handlePageTitleChange(e.target.value)}
                    placeholder="Judul Halaman..."
                    className="text-lg md:text-xl font-black bg-transparent border-none text-text-primary outline-none focus:ring-0 flex-1 min-w-[200px]"
                  />

                  {/* Actions for active page */}
                  <div className="flex items-center gap-2">
                    {/* Pin button */}
                    <button
                      onClick={togglePin}
                      className={`p-1.5 rounded-lg border text-xs transition-all ${
                        activePage.pinned ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'text-text-muted hover:text-text-primary border-border'
                      }`}
                      title={activePage.pinned ? 'Lepas Pin' : 'Sematkan Halaman'}
                    >
                      <Pin size={14} />
                    </button>

                    {/* Lock button */}
                    <button
                      onClick={() => {
                        if (activePage.locked) handleLockPage();
                        else setShowLockModal(true);
                      }}
                      className={`p-1.5 rounded-lg border text-xs transition-all ${
                        activePage.locked ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'text-text-muted hover:text-text-primary border-border'
                      }`}
                      title={activePage.locked ? 'Gembok Aktif (Klik untuk buka gembok)' : 'Kunci dengan Sandi'}
                    >
                      {activePage.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>

                    {/* Color accents */}
                    <div className="flex items-center gap-1 border-l border-border pl-2">
                      {coverColors.map(c => (
                        <button
                          key={c}
                          onClick={() => setCoverColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-4 h-4 rounded-full transition-transform ${
                            activePage.cover_color === c ? 'scale-125 ring-2 ring-white/50' : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tags row */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Tag size={13} className="text-text-muted" />
                  {currentTags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/30 border border-border text-cyan-300">
                      #{t}
                      <button onClick={() => removeTag(t)} className="text-text-muted hover:text-rose-400">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="+ Tambah tag (Enter)..."
                    className="bg-transparent border-none outline-none text-text-muted text-xs w-32 focus:w-48 transition-all"
                  />
                </div>
              </div>

              {/* Page Content Body (with Lock barrier check) */}
              {isPageLocked ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl">
                    <Lock size={32} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-text-primary">Halaman Ini Digembok Sandi</h3>
                    <p className="text-xs text-text-muted mt-1">Masukkan kata sandi pengunci untuk membuka isi catatan.</p>
                  </div>
                  <div className="flex gap-2 max-w-xs w-full">
                    <input
                      type="password"
                      placeholder="Kata sandi..."
                      value={unlockPasswordInput}
                      onChange={e => setUnlockPasswordInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleUnlockPage()}
                      className="flex-1 px-3 py-2 bg-black/30 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={handleUnlockPage}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 text-black hover:bg-cyan-400"
                    >
                      Buka
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col">
                  <RichEditor
                    content={activePage.content}
                    onChange={handlePageContentChange}
                    placeholder="Tulis ide atau catatan super Anda di sini... (Bisa ketik, paste foto, checklist, atau tabel)"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
              Pilih halaman di sebelah kiri atau klik Baru untuk mulai.
            </div>
          )}
        </div>

        {/* Right Pane: Split Screen View (if enabled) */}
        {splitMode && (
          <div className="flex-1 flex flex-col min-w-0 bg-surface border border-border rounded-2xl overflow-hidden p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-400">Layar 2:</span>
                <select
                  value={secondPageId || ''}
                  onChange={e => setSecondPageId(Number(e.target.value))}
                  className="bg-black/30 border border-border text-xs rounded-xl px-2.5 py-1.5 text-text-primary outline-none"
                >
                  {pages.map(p => (
                    <option key={p.id} value={p.id} className="bg-surface text-text-primary">
                      {p.page_title}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setSplitMode(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5"
              >
                <X size={14} />
              </button>
            </div>

            {secondPage ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <RichEditor
                  content={secondPage.content}
                  onChange={handleSecondPageContentChange}
                  placeholder="Catatan pada halaman pembanding..."
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
                Pilih halaman untuk pembanding di atas.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lock Page Setup Modal */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-text-primary flex items-center gap-2">
                <Lock size={16} className="text-amber-400" /> Kunci Halaman Ini
              </h4>
              <button onClick={() => setShowLockModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-text-muted">
              Masukkan kata sandi pribadi untuk mengamankan halaman catatan ini:
            </p>
            <input
              type="password"
              placeholder="Kata sandi baru..."
              value={lockPassword}
              onChange={e => setLockPassword(e.target.value)}
              className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLockModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-text-muted hover:bg-white/5"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleLockPage}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400"
              >
                Gembok Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h4 className="font-bold text-sm text-text-primary flex items-center gap-2">
                <History size={16} className="text-cyan-400" /> Riwayat Versi Halaman
              </h4>
              <button onClick={() => setShowHistory(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {history.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-muted">
                  Belum ada snapshot riwayat untuk halaman ini.
                </div>
              ) : (
                history.map((h, i) => (
                  <div
                    key={h.id}
                    className="p-3 bg-black/20 border border-border rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-text-primary">Versi {history.length - i}</div>
                      <div className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
                        <Clock size={11} /> {h.created_at}
                      </div>
                      <div className="text-[11px] text-text-muted mt-1 line-clamp-1">
                        {h.content.replace(/<[^>]*>/g, '').slice(0, 50)}...
                      </div>
                    </div>
                    <button
                      onClick={() => restoreHistory(h)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 font-semibold shrink-0"
                    >
                      Pulihkan
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
