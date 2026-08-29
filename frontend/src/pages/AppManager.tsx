import React, { useEffect, useState } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { Plus, Search, Copy, ExternalLink, X, Trash2, Edit2, Box } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';
import { encryptData, decryptData } from '../utils/crypto';
import toast from 'react-hot-toast';

export const AppManager = () => {
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    status: 'LOKAL', // LOKAL, SAAS, ANDROID, EXE
    saasUrl: '',
    exePath: '',
    androidPath: '',
    notes: ''
  });

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      if (res.data.success && masterPassword) {
        const decryptedItems = await Promise.all(res.data.data.map(async (item: any) => {
          try {
            const decStr = await decryptData(item.encryptedData, masterPassword);
            const decData = JSON.parse(decStr);
            return { ...item, decrypted: decData };
          } catch (err) {
            return { ...item, decrypted: null };
          }
        }));
        setItems(decryptedItems.filter(item => item.type === 'app_project'));
      }
    } catch (error) {
      console.error(error);
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

    setSaving(true);
    try {
      const dataToEncrypt = JSON.stringify({
        title: formData.title,
        status: formData.status,
        saasUrl: formData.saasUrl,
        exePath: formData.exePath,
        androidPath: formData.androidPath,
        notes: formData.notes
      });

      const encryptedData = await encryptData(dataToEncrypt, masterPassword);

      if (editingItemId) {
        await axios.put(`${API_URL}/api/vault/${editingItemId}`, {
          title: formData.title,
          encryptedData,
          favorite: false
        }, { withCredentials: true });
        toast.success('Berhasil mengubah aplikasi');
      } else {
        await axios.post(`${API_URL}/api/vault`, {
          type: 'app_project',
          title: formData.title,
          encryptedData,
          favorite: false
        }, { withCredentials: true });
        toast.success('Berhasil menyimpan aplikasi');
      }

      setIsModalOpen(false);
      resetForm();
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus aplikasi ini?')) return;
    try {
      await axios.delete(`${API_URL}/api/vault/${id}`, { withCredentials: true });
      toast.success('Aplikasi dihapus');
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus data');
    }
  };

  const openEditModal = (item: any) => {
    const dec = item.decrypted || {};
    setFormData({
      title: item.title || '',
      status: dec.status || 'LOKAL',
      saasUrl: dec.saasUrl || '',
      exePath: dec.exePath || '',
      androidPath: dec.androidPath || '',
      notes: dec.notes || ''
    });
    setEditingItemId(item.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ title: '', status: 'LOKAL', saasUrl: '', exePath: '', androidPath: '', notes: '' });
    setEditingItemId(null);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} dicopy!`);
  };

  const openUrl = (url: string) => {
    if (url) {
      window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
    }
  };

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box size={20} className="text-primary" />
            <h1 className="text-lg font-bold text-text-primary">App Manager</h1>
          </div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-primary/20 hover:bg-primary/30 text-primary p-2 rounded-xl transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="relative w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Cari aplikasi..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-surface rounded-xl p-3 border border-border hover:border-primary/50 transition-colors flex flex-col gap-2 relative group">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold uppercase shrink-0">
                      {item.title.substring(0, 1)}
                    </div>
                    <div>
                      <h3 className="font-bold text-text-primary text-sm line-clamp-1">{item.title}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-border text-text-secondary font-medium uppercase">
                        {item.decrypted?.status || 'LOKAL'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(item)} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded">
                      <Edit2 size={14} className="text-text-muted hover:text-text-primary" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-red-500/10 rounded">
                      <Trash2 size={14} className="text-text-muted hover:text-red-500" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  {item.decrypted?.saasUrl && (
                    <div className="flex items-center gap-2 bg-black/5 dark:bg-black/20 p-1.5 rounded-lg">
                      <div className="flex-1 truncate text-xs text-text-secondary">
                        🌐 {item.decrypted.saasUrl}
                      </div>
                      <button onClick={() => copyToClipboard(item.decrypted.saasUrl, 'URL')} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded shrink-0" title="Copy URL">
                        <Copy size={12} className="text-primary" />
                      </button>
                      <button onClick={() => openUrl(item.decrypted.saasUrl)} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded shrink-0" title="Buka URL">
                        <ExternalLink size={12} className="text-primary" />
                      </button>
                    </div>
                  )}

                  {item.decrypted?.exePath && (
                    <div className="flex items-center gap-2 bg-black/5 dark:bg-black/20 p-1.5 rounded-lg">
                      <div className="flex-1 truncate text-[10px] text-text-secondary font-mono" title={item.decrypted.exePath}>
                        💻 {item.decrypted.exePath}
                      </div>
                      <button onClick={() => copyToClipboard(item.decrypted.exePath, 'Path EXE')} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded shrink-0" title="Copy Path">
                        <Copy size={12} className="text-primary" />
                      </button>
                    </div>
                  )}

                  {item.decrypted?.androidPath && (
                    <div className="flex items-center gap-2 bg-black/5 dark:bg-black/20 p-1.5 rounded-lg">
                      <div className="flex-1 truncate text-[10px] text-text-secondary font-mono" title={item.decrypted.androidPath}>
                        📱 {item.decrypted.androidPath}
                      </div>
                      <button onClick={() => copyToClipboard(item.decrypted.androidPath, 'Path Android')} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded shrink-0" title="Copy Path">
                        <Copy size={12} className="text-primary" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {filteredItems.length === 0 && (
              <div className="col-span-full py-8 text-center text-text-muted text-sm">
                Tidak ada aplikasi ditemukan.
              </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-bg-primary w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h2 className="font-bold text-text-primary text-sm flex items-center gap-2">
                <Box size={16} className="text-primary" />
                {editingItemId ? 'Edit Aplikasi' : 'Tambah Aplikasi'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Nama Aplikasi *</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Status Deploy</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                >
                  <option value="LOKAL">Sedang Develop (Lokal)</option>
                  <option value="SAAS">Live (SaaS / Web)</option>
                  <option value="EXE">Desktop (EXE)</option>
                  <option value="ANDROID">Android (APK / PlayStore)</option>
                  <option value="MULTI">Multi-Platform</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">URL Web / SaaS (Opsional)</label>
                <input 
                  type="text" 
                  placeholder="https://app.com"
                  value={formData.saasUrl}
                  onChange={(e) => setFormData({...formData, saasUrl: e.target.value})}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Path Folder EXE (Opsional)</label>
                <input 
                  type="text" 
                  placeholder="Drive A/bla/bla"
                  value={formData.exePath}
                  onChange={(e) => setFormData({...formData, exePath: e.target.value})}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Path APK / PlayStore (Opsional)</label>
                <input 
                  type="text" 
                  placeholder="Drive B/bla/bla"
                  value={formData.androidPath}
                  onChange={(e) => setFormData({...formData, androidPath: e.target.value})}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={saving || !formData.title}
                  className="w-full bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium shadow-md text-xs"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Aplikasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
