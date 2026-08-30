import React, { useState, useEffect } from 'react';
import { 
  Library, Plus, Search, Link2, Book, MessageSquare, ExternalLink, 
  Trash2, FileDown, Edit3, Image as ImageIcon, Mic 
} from 'lucide-react';
import { VoiceRecorderModal } from '../components/VoiceRecorderModal';
import axios from 'axios';
import { useVaultStore } from '../store/vaultStore';
import { encryptData, decryptData } from '../utils/crypto';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

interface KnowledgeItem {
  id: string;
  type: string;
  name: string;
  decrypted: {
    category: 'link' | 'ebook' | 'prompt';
    title: string;
    url: string;
    coverUrl?: string;
    content: string;
  };
}

export const KnowledgeBase: React.FC = () => {
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'link' | 'ebook' | 'prompt'>('all');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formCategory, setFormCategory] = useState<'link' | 'ebook' | 'prompt'>('link');
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [formContent, setFormContent] = useState('');

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      if (res.data.success && masterPassword) {
        const decItems = await Promise.all(res.data.data
          .filter((item: any) => item.type === 'knowledge')
          .map(async (item: any) => {
            try {
              const decStr = await decryptData(item.encryptedData, masterPassword);
              return { ...item, decrypted: JSON.parse(decStr) };
            } catch (e) {
              return { ...item, decrypted: null };
            }
          })
        );
        setItems(decItems.filter(i => i.decrypted));
      }
    } catch (error) {
      toast.error('Gagal mengambil data Pustaka.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;

    try {
      const dataToEncrypt = JSON.stringify({
        category: formCategory,
        title: formTitle,
        url: formUrl,
        coverUrl: formCoverUrl,
        content: formContent
      });

      const encryptedData = await encryptData(dataToEncrypt, masterPassword);

      if (editingId) {
        await axios.put(`${API_URL}/api/vault/${editingId}`, {
          type: 'knowledge',
          name: formTitle,
          encryptedData
        }, { withCredentials: true });
        toast.success('Pustaka diperbarui!');
      } else {
        await axios.post(`${API_URL}/api/vault`, {
          type: 'knowledge',
          name: formTitle,
          encryptedData
        }, { withCredentials: true });
        toast.success('Pustaka ditambahkan!');
      }
      
      setIsModalOpen(false);
      fetchItems();
    } catch (error) {
      toast.error('Gagal menyimpan Pustaka.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus pustaka ini?')) return;
    try {
      await axios.delete(`${API_URL}/api/vault/${id}`, { withCredentials: true });
      toast.success('Pustaka dihapus!');
      fetchItems();
    } catch (error) {
      toast.error('Gagal menghapus pustaka.');
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormCategory('link');
    setFormTitle('');
    setFormUrl('');
    setFormCoverUrl('');
    setFormContent('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setFormCategory(item.decrypted.category);
    setFormTitle(item.decrypted.title);
    setFormUrl(item.decrypted.url);
    setFormCoverUrl(item.decrypted.coverUrl || '');
    setFormContent(item.decrypted.content);
    setIsModalOpen(true);
  };

  const exportToCSV = () => {
    if (items.length === 0) return toast.error('Tidak ada data untuk di-export.');
    
    // Format: Kategori, Judul, URL, Catatan/Prompt
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Kategori,Judul,URL,Konten\\n";
    
    items.forEach(item => {
      const { category, title, url, content } = item.decrypted;
      // Escape quotes and commas
      const escCategory = `"${category.replace(/"/g, '""')}"`;
      const escTitle = `"${title.replace(/"/g, '""')}"`;
      const escUrl = `"${url.replace(/"/g, '""')}"`;
      const escContent = `"${content.replace(/"/g, '""')}"`;
      
      csvContent += `${escCategory},${escTitle},${escUrl},${escContent}\\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Gudang_Pustaka.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Berhasil export ke CSV (Spreadsheet)');
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = (item.decrypted.title || '').toLowerCase().includes(search.toLowerCase()) || 
                          (item.decrypted.content || '').toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || item.decrypted.category === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-500 mb-2 flex items-center gap-3">
            <Library size={32} className="text-rose-500" />
            Gudang Pustaka
          </h1>
          <p className="text-text-muted">Manajemen sentral untuk Inspirasi, E-Book, dan Prompt AI.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={exportToCSV}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-sm font-bold text-text-primary hover:border-primary/50 transition-all"
          >
            <FileDown size={18} />
            Export CSV
          </button>
                    <button 
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-sm font-bold shadow-lg shadow-purple-500/30 transition-all"
          >
            <Mic size={18} />
            Voice Note AI
          </button>
          <button 
            onClick={openAddModal}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white text-sm font-bold shadow-lg shadow-rose-500/30 transition-all"
          >
            <Plus size={18} />
            Tambah Data
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
          <input
            type="text"
            placeholder="Cari pustaka (Judul, Catatan, Prompt)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-3 text-text-primary focus:outline-none focus:border-rose-500 transition-colors"
          />
        </div>
        <div className="flex bg-surface p-1 rounded-xl border border-border overflow-x-auto">
          {[
            { id: 'all', label: 'Semua', icon: Library },
            { id: 'link', label: 'Inspirasi', icon: Link2 },
            { id: 'ebook', label: 'E-Book', icon: Book },
            { id: 'prompt', label: 'Prompt AI', icon: MessageSquare }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id 
                  ? 'bg-rose-500/10 text-rose-500' 
                  : 'text-text-muted hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[400px]">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-muted space-y-4">
            <Library size={48} className="opacity-20" />
            <p>Pustaka masih kosong atau tidak ditemukan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
            {filteredItems.map(item => (
              <div key={item.id} className="group flex flex-col bg-surface border border-border hover:border-rose-500/50 rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-xl hover:shadow-rose-500/10">
                {/* Thumbnail Header (khusus Ebook atau jika ada cover) */}
                {item.decrypted.category === 'ebook' && item.decrypted.coverUrl ? (
                  <div className="h-40 w-full overflow-hidden bg-black/5 relative">
                    <img src={item.decrypted.coverUrl} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold text-white flex items-center gap-1">
                      <Book size={12} /> E-BOOK
                    </div>
                  </div>
                ) : (
                  <div className={`h-2 w-full ${
                    item.decrypted.category === 'link' ? 'bg-cyan-500' : 
                    item.decrypted.category === 'ebook' ? 'bg-amber-500' : 'bg-purple-500'
                  }`} />
                )}

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-bold text-text-primary line-clamp-2 leading-tight">
                      {item.decrypted.title}
                    </h3>
                    {item.decrypted.category !== 'ebook' && (
                      <span className="shrink-0 p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-text-muted">
                        {item.decrypted.category === 'link' ? <Link2 size={16} className="text-cyan-500" /> : <MessageSquare size={16} className="text-purple-500" />}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-text-muted line-clamp-3 flex-1 mb-4">
                    {item.decrypted.content || 'Tidak ada catatan...'}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-border">
                    {item.decrypted.url && (
                      <a 
                        href={item.decrypted.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors"
                      >
                        Buka Link <ExternalLink size={12} />
                      </a>
                    )}
                    <button 
                      onClick={() => openEditModal(item)}
                      className="p-2 rounded-lg text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl border border-border my-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Library size={24} className="text-rose-500" />
                {editingId ? 'Edit Pustaka' : 'Tambah Pustaka'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-text-muted transition-colors">
                <Trash2 size={20} className="hidden" /> {/* Dummy spacing */}
                <span className="font-black">âœ•</span>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              
              <div className="grid grid-cols-3 gap-3 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
                {[
                  { id: 'link', label: 'Inspirasi', icon: Link2 },
                  { id: 'ebook', label: 'E-Book', icon: Book },
                  { id: 'prompt', label: 'Prompt AI', icon: MessageSquare }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormCategory(cat.id as any)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg text-xs font-bold transition-all ${
                      formCategory === cat.id 
                        ? 'bg-surface shadow-md text-rose-500 border border-border' 
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <cat.icon size={18} />
                    {cat.label}
                  </button>
                ))}
              </div>

              <div>
                <input
                  required
                  type="text"
                  placeholder="Judul (Misal: Video FYP Strategi Marketing)"
                  className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-rose-500 transition-colors"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                />
              </div>

              <div>
                <div className="relative">
                  <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="url"
                    placeholder="URL Akses (Link G-Drive / TikTok / Web)"
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl pl-10 pr-4 py-3 text-text-primary focus:outline-none focus:border-rose-500 transition-colors"
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                  />
                </div>
              </div>

              {formCategory === 'ebook' && (
                <div>
                  <div className="relative">
                    <ImageIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="url"
                      placeholder="URL Cover Buku (Opsional)"
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl pl-10 pr-4 py-3 text-text-primary focus:outline-none focus:border-rose-500 transition-colors"
                      value={formCoverUrl}
                      onChange={e => setFormCoverUrl(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <textarea
                  placeholder={formCategory === 'prompt' ? "Tulis Prompt AI di sini..." : "Catatan / Insight yang didapat..."}
                  className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-rose-500 transition-colors h-32 resize-none"
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white font-bold text-sm shadow-lg shadow-rose-500/25 transition-all"
                >
                  SIMPAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Voice Recorder Modal */}
      {isVoiceModalOpen && (
        <VoiceRecorderModal 
          onClose={() => setIsVoiceModalOpen(false)} 
          onSuccess={fetchItems} 
        />
      )}
    </div>
  );
};

