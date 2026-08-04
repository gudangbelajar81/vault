import React, { useEffect, useState } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { Plus, Search, MoreVertical, ExternalLink, X, RefreshCw, LayoutGrid, Globe } from 'lucide-react';
import axios from 'axios';
import { encryptData, decryptData } from '../utils/crypto';
import { API_URL } from '../config';

interface ShortcutItem {
  id: string;
  type: string;
  title: string;
  favorite: boolean;
  decryptedData?: any;
  encryptedData: string;
}

export const Shortcuts = () => {
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<ShortcutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    url: '',
    description: '',
  });

  const fetchItems = async () => {
    if (!masterPassword) return;
    try {
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      const shortcutItems = (res.data.data || []).filter((i: any) => i.type === 'shortcut');
      
      const decrypted = await Promise.all(
        shortcutItems.map(async (item: ShortcutItem) => {
          try {
            const dataStr = await decryptData(item.encryptedData, masterPassword);
            item.decryptedData = JSON.parse(dataStr);
          } catch (e) {
            item.decryptedData = { url: '', description: '' };
          }
          return item;
        })
      );
      setItems(decrypted);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [masterPassword]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;
    setSaving(true);
    
    try {
      const dataToEncrypt = JSON.stringify({
        url: formData.url,
        description: formData.description
      });
      
      const encryptedData = await encryptData(dataToEncrypt, masterPassword);
      
      const payload = {
        type: 'shortcut',
        title: formData.title,
        encryptedData,
        favorite: false
      };

      if (formData.id) {
        await axios.put(`${API_URL}/api/vault/${formData.id}`, payload, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/api/vault`, payload, { withCredentials: true });
      }
      
      setIsModalOpen(false);
      setFormData({ id: '', title: '', url: '', description: '' });
      fetchItems();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan Shortcut');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: ShortcutItem) => {
    setFormData({
      id: item.id,
      title: item.title,
      url: item.decryptedData?.url || '',
      description: item.decryptedData?.description || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus Shortcut ini?')) return;
    try {
      await axios.delete(`${API_URL}/api/vault/${id}`, { withCredentials: true });
      fetchItems();
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus');
    }
  };

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(search.toLowerCase()) || 
    (item.decryptedData?.description && item.decryptedData.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-md bg-primary/20 text-primary flex items-center justify-center shrink-0">
             <Globe size={14} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary leading-tight">Pusat Akses Cepat</h2>
            <p className="text-[10px] text-text-muted leading-tight">Bookmark tautan penting</p>
          </div>
        </div>
        <button 
          onClick={() => { setFormData({ id: '', title: '', url: '', description: '' }); setIsModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-transform active:scale-95 shadow-md text-xs"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Jalan Pintas Baru</span>
          <span className="sm:hidden">Baru</span>
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
        <input 
          type="text" 
          placeholder="Cari shortcut..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-text-muted/50 backdrop-blur-sm"
        />
      </div>

      <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-hidden backdrop-blur-sm p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <RefreshCw className="animate-spin" size={24} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col text-text-muted h-full opacity-50">
            <LayoutGrid size={48} className="mb-4" />
            <p>Belum ada tautan cepat yang disimpan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-surface border border-border rounded-xl p-4 hover:border-primary/50 transition-colors group relative flex flex-col h-full cursor-pointer"
                   onClick={() => window.open(item.decryptedData?.url?.startsWith('http') ? item.decryptedData.url : `https://${item.decryptedData?.url}`, '_blank')}
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="p-1.5 bg-surface rounded-md text-text-muted hover:text-text-primary backdrop-blur-md"><MoreVertical size={14}/></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-1.5 bg-surface rounded-md text-danger hover:text-danger/80 backdrop-blur-md"><X size={14}/></button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
                    <Globe size={28} />
                  </div>
                  <h3 className="text-text-primary font-semibold text-lg line-clamp-1">{item.title}</h3>
                  {item.decryptedData?.description && (
                    <p className="text-xs text-text-muted mt-2 line-clamp-2">{item.decryptedData.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false) }}>
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-text-primary">{formData.id ? 'Edit Shortcut' : 'Tambah Shortcut'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={22} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Judul Shortcut</label>
                <input 
                  type="text" required value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-3 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">URL Tautan</label>
                <input 
                  type="url" required value={formData.url}
                  onChange={e => setFormData({...formData, url: e.target.value})}
                  placeholder="https://example.com"
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-3 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Deskripsi (Opsional)</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  rows={2}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-3 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium">Batal</button>
                <button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium shadow-md">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};