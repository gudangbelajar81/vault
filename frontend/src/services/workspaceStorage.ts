import localforage from 'localforage';

export interface NotePage {
  id: number;
  note_id: number;
  page_title: string;
  content: string;
  sort_order: number;
  tags?: string;
  pinned?: number;
  cover_color?: string;
  cover_image?: string;
  locked?: number;
  passwordHash?: string;
}

export interface PageHistoryItem {
  id: number;
  page_id: number;
  page_title: string;
  content: string;
  created_at: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  folder: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
}

export interface StickyItem {
  id: number;
  content: string;
  color: string;
  pos_x: number;
  pos_y: number;
  created_at: string;
}

export interface SheetItem {
  id: number;
  title: string;
  data: string; // JSON string[][]
  created_at: string;
  updated_at: string;
}

export interface BookmarkItem {
  id: number;
  url: string;
  title: string;
  note: string;
  folder: string | null;
  created_at: string;
}

export interface SearchResultItem {
  id: number;
  note_id: number;
  page_title: string;
  content: string;
  tags: string;
  note_title: string;
}

// Inisialisasi localforage store
const rkStore = localforage.createInstance({
  name: 'VaultPro_Workspace',
  storeName: 'ruang_kerja_data'
});

const defaultNotes: Note[] = [
  {
    id: 1,
    title: 'Buku Catatan Utama',
    content: 'Selamat datang di Ruang Kerja VaultPro!',
    folder: null,
    pinned: 1,
    created_at: new Date().toLocaleDateString('id-ID'),
    updated_at: new Date().toLocaleDateString('id-ID'),
  }
];

const defaultPages: NotePage[] = [
  {
    id: 101,
    note_id: 1,
    page_title: 'Halaman 1: Panduan Ruang Kerja',
    content: '<h2>Selamat Datang di Ruang Kerja VaultPro</h2><p>Fitur ini diduplikasi dari PC Manager dengan integrasi penuh:</p><ul><li><b>Catatan Pintar:</b> Buku multi-halaman dengan rich text, upload gambar, split screen, dan proteksi password.</li><li><b>Catatan Tempel:</b> Sticky notes warna-warni untuk memo kilat.</li><li><b>Papan Gambar:</b> Whiteboard canvas untuk sketsa dan coretan ide.</li><li><b>Tabel Cepat:</b> Mini spreadsheet dengan ekspor CSV.</li><li><b>Bookmark:</b> Simpan URL penting dengan catatan login.</li></ul><p>Semua data tersimpan otomatis di perangkat Anda!</p>',
    sort_order: 0,
    tags: 'panduan,fitur,utama',
    pinned: 1,
    cover_color: '#00f0ff',
  }
];

const defaultStickies: StickyItem[] = [
  { id: 1, content: '📌 Ingat cek lisensi klien jam 3 sore', color: '#ffea00', pos_x: 0, pos_y: 0, created_at: new Date().toLocaleDateString('id-ID') },
  { id: 2, content: '💡 Ide: Update template kasir minggu depan', color: '#51cf66', pos_x: 0, pos_y: 0, created_at: new Date().toLocaleDateString('id-ID') },
  { id: 3, content: '⚡ Task: Backup data brankas setiap hari', color: '#339af0', pos_x: 0, pos_y: 0, created_at: new Date().toLocaleDateString('id-ID') }
];

export const wsStorage = {
  // ── NOTES ──
  async getNotes(): Promise<Note[]> {
    const data = await rkStore.getItem<Note[]>('notes');
    if (!data || data.length === 0) {
      await rkStore.setItem('notes', defaultNotes);
      return defaultNotes;
    }
    return data;
  },

  async saveNote(note: Partial<Note> & { title: string }): Promise<Note> {
    const notes = await this.getNotes();
    if (note.id) {
      const idx = notes.findIndex(n => n.id === note.id);
      if (idx !== -1) {
        notes[idx] = { ...notes[idx], ...note, updated_at: new Date().toLocaleDateString('id-ID') };
        await rkStore.setItem('notes', notes);
        return notes[idx];
      }
    }
    const newNote: Note = {
      id: Date.now(),
      title: note.title || 'Catatan Baru',
      content: note.content || '',
      folder: note.folder || null,
      pinned: note.pinned || 0,
      created_at: new Date().toLocaleDateString('id-ID'),
      updated_at: new Date().toLocaleDateString('id-ID'),
    };
    notes.unshift(newNote);
    await rkStore.setItem('notes', notes);
    return newNote;
  },

  async deleteNote(id: number): Promise<void> {
    const notes = await this.getNotes();
    await rkStore.setItem('notes', notes.filter(n => n.id !== id));
    // Hapus juga halaman-halaman miliknya
    const pages = await this.getAllPages();
    await rkStore.setItem('pages', pages.filter(p => p.note_id !== id));
  },

  // ── PAGES ──
  async getAllPages(): Promise<NotePage[]> {
    const data = await rkStore.getItem<NotePage[]>('pages');
    if (!data || data.length === 0) {
      await rkStore.setItem('pages', defaultPages);
      return defaultPages;
    }
    return data;
  },

  async getPages(noteId: number): Promise<NotePage[]> {
    const pages = await this.getAllPages();
    return pages.filter(p => p.note_id === noteId).sort((a, b) => a.sort_order - b.sort_order);
  },

  async addPage(noteId: number, title: string, content = ''): Promise<NotePage> {
    const pages = await this.getAllPages();
    const notePages = pages.filter(p => p.note_id === noteId);
    const newPage: NotePage = {
      id: Date.now(),
      note_id: noteId,
      page_title: title || 'Halaman ' + (notePages.length + 1),
      content,
      sort_order: notePages.length,
      tags: '',
      pinned: 0,
      locked: 0,
    };
    pages.push(newPage);
    await rkStore.setItem('pages', pages);
    return newPage;
  },

  async updatePage(pageId: number, updates: Partial<NotePage>): Promise<boolean> {
    const pages = await this.getAllPages();
    const idx = pages.findIndex(p => p.id === pageId);
    if (idx === -1) return false;
    
    // Save history snapshot if content changed
    if (updates.content && updates.content !== pages[idx].content) {
      await this.savePageHistory(pageId, pages[idx].page_title, pages[idx].content);
    }

    pages[idx] = { ...pages[idx], ...updates };
    await rkStore.setItem('pages', pages);
    return true;
  },

  async deletePage(pageId: number): Promise<boolean> {
    const pages = await this.getAllPages();
    await rkStore.setItem('pages', pages.filter(p => p.id !== pageId));
    return true;
  },

  // ── SEARCH ──
  async searchPages(query: string): Promise<SearchResultItem[]> {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const notes = await this.getNotes();
    const pages = await this.getAllPages();
    const notesMap = new Map(notes.map(n => [n.id, n.title]));

    const results: SearchResultItem[] = [];
    for (const p of pages) {
      const cleanContent = p.content.replace(/<[^>]*>/g, '').toLowerCase();
      const matchTitle = p.page_title.toLowerCase().includes(q);
      const matchContent = cleanContent.includes(q);
      const matchTags = (p.tags || '').toLowerCase().includes(q);

      if (matchTitle || matchContent || matchTags) {
        results.push({
          id: p.id,
          note_id: p.note_id,
          page_title: p.page_title,
          content: p.content,
          tags: p.tags || '',
          note_title: notesMap.get(p.note_id) || 'Buku Catatan'
        });
      }
    }
    return results;
  },

  // ── HISTORY ──
  async getPageHistory(pageId: number): Promise<PageHistoryItem[]> {
    const allHistory = await rkStore.getItem<PageHistoryItem[]>('history') || [];
    return allHistory.filter(h => h.page_id === pageId).slice(-15);
  },

  async savePageHistory(pageId: number, pageTitle: string, content: string): Promise<void> {
    if (!content.trim()) return;
    const allHistory = await rkStore.getItem<PageHistoryItem[]>('history') || [];
    const item: PageHistoryItem = {
      id: Date.now(),
      page_id: pageId,
      page_title: pageTitle,
      content,
      created_at: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    allHistory.push(item);
    // Keep max 100 history items overall
    await rkStore.setItem('history', allHistory.slice(-100));
  },

  async restorePageHistory(pageId: number, historyId: number): Promise<boolean> {
    const allHistory = await rkStore.getItem<PageHistoryItem[]>('history') || [];
    const target = allHistory.find(h => h.id === historyId);
    if (!target) return false;
    return await this.updatePage(pageId, { content: target.content });
  },

  // ── STICKIES ──
  async getStickies(): Promise<StickyItem[]> {
    const data = await rkStore.getItem<StickyItem[]>('stickies');
    if (!data) {
      await rkStore.setItem('stickies', defaultStickies);
      return defaultStickies;
    }
    return data;
  },

  async saveSticky(sticky: Partial<StickyItem> & { color: string }): Promise<StickyItem> {
    const stickies = await this.getStickies();
    if (sticky.id) {
      const idx = stickies.findIndex(s => s.id === sticky.id);
      if (idx !== -1) {
        stickies[idx] = { ...stickies[idx], ...sticky };
        await rkStore.setItem('stickies', stickies);
        return stickies[idx];
      }
    }
    const newItem: StickyItem = {
      id: Date.now(),
      content: sticky.content || '',
      color: sticky.color,
      pos_x: 0,
      pos_y: 0,
      created_at: new Date().toLocaleDateString('id-ID')
    };
    stickies.unshift(newItem);
    await rkStore.setItem('stickies', stickies);
    return newItem;
  },

  async deleteSticky(id: number): Promise<void> {
    const stickies = await this.getStickies();
    await rkStore.setItem('stickies', stickies.filter(s => s.id !== id));
  },

  // ── DRAWING CANVAS ──
  async getCanvasDrawing(): Promise<string | null> {
    return await rkStore.getItem<string>('canvas_drawing');
  },

  async saveCanvasDrawing(dataUrl: string): Promise<void> {
    await rkStore.setItem('canvas_drawing', dataUrl);
  },

  async clearCanvasDrawing(): Promise<void> {
    await rkStore.removeItem('canvas_drawing');
  },

  // ── SHEETS ──
  async getSheets(): Promise<SheetItem[]> {
    const data = await rkStore.getItem<SheetItem[]>('sheets');
    return data || [];
  },

  async getSheet(id: number): Promise<SheetItem | null> {
    const sheets = await this.getSheets();
    return sheets.find(s => s.id === id) || null;
  },

  async saveSheet(sheet: Partial<SheetItem> & { title: string }): Promise<SheetItem> {
    const sheets = await this.getSheets();
    if (sheet.id) {
      const idx = sheets.findIndex(s => s.id === sheet.id);
      if (idx !== -1) {
        sheets[idx] = { ...sheets[idx], ...sheet, updated_at: new Date().toLocaleDateString('id-ID') };
        await rkStore.setItem('sheets', sheets);
        return sheets[idx];
      }
    }
    const newSheet: SheetItem = {
      id: Date.now(),
      title: sheet.title || 'Tabel Baru',
      data: sheet.data || JSON.stringify([['', '', ''], ['', '', ''], ['', '', '']]),
      created_at: new Date().toLocaleDateString('id-ID'),
      updated_at: new Date().toLocaleDateString('id-ID')
    };
    sheets.unshift(newSheet);
    await rkStore.setItem('sheets', sheets);
    return newSheet;
  },

  async deleteSheet(id: number): Promise<void> {
    const sheets = await this.getSheets();
    await rkStore.setItem('sheets', sheets.filter(s => s.id !== id));
  },

  // ── BOOKMARKS ──
  async getBookmarks(): Promise<BookmarkItem[]> {
    const data = await rkStore.getItem<BookmarkItem[]>('bookmarks');
    return data || [];
  },

  async saveBookmark(b: { url: string; title: string; note: string }): Promise<BookmarkItem> {
    const bookmarks = await this.getBookmarks();
    const item: BookmarkItem = {
      id: Date.now(),
      url: b.url,
      title: b.title || b.url,
      note: b.note || '',
      folder: null,
      created_at: new Date().toLocaleDateString('id-ID')
    };
    bookmarks.unshift(item);
    await rkStore.setItem('bookmarks', bookmarks);
    return item;
  },

  async deleteBookmark(id: number): Promise<void> {
    const bookmarks = await this.getBookmarks();
    await rkStore.setItem('bookmarks', bookmarks.filter(b => b.id !== id));
  },

  // ── BACKUP & RESTORE ──
  async exportAllData(): Promise<string> {
    const data = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      notes: await this.getNotes(),
      pages: await this.getAllPages(),
      stickies: await this.getStickies(),
      sheets: await this.getSheets(),
      bookmarks: await this.getBookmarks(),
      canvas_drawing: await this.getCanvasDrawing(),
    };
    return JSON.stringify(data, null, 2);
  },

  async importAllData(jsonStr: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonStr);
      if (data.notes) await rkStore.setItem('notes', data.notes);
      if (data.pages) await rkStore.setItem('pages', data.pages);
      if (data.stickies) await rkStore.setItem('stickies', data.stickies);
      if (data.sheets) await rkStore.setItem('sheets', data.sheets);
      if (data.bookmarks) await rkStore.setItem('bookmarks', data.bookmarks);
      if (data.canvas_drawing) await rkStore.setItem('canvas_drawing', data.canvas_drawing);
      return true;
    } catch {
      return false;
    }
  }
};
