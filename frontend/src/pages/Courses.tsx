import React, { useEffect, useState } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { Plus, Search, MoreVertical, Copy, ExternalLink, GraduationCap, X, RefreshCw, BookOpen } from 'lucide-react';
import axios from 'axios';
import { encryptData, decryptData } from '../utils/crypto';
import { API_URL } from '../config';

interface CourseItem {
  id: string;
  type: string;
  title: string;
  favorite: boolean;
  decryptedData?: any;
  encryptedData: string;
}

export const Courses = () => {
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    id: '',
    platform: '',
    url: '',
    username: '',
    password: '',
    notes: '',
  });

  const fetchItems = async () => {
    if (!masterPassword) return;
    try {
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      const courseItems = (res.data.data || []).filter((i: any) => i.type === 'course');
      
      const decrypted = await Promise.all(
        courseItems.map(async (item: CourseItem) => {
          try {
            const dataStr = await decryptData(item.encryptedData, masterPassword);
            item.decryptedData = JSON.parse(dataStr);
          } catch (e) {
            item.decryptedData = { platform: 'Error', url: '', username: '', password: '', notes: '' };
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;
    setSaving(true);
    
    try {
      const dataToEncrypt = JSON.stringify({
        platform: formData.platform,
        url: formData.url,
        username: formData.username,
        password: formData.password,
        notes: formData.notes
      });
      
      const encryptedData = await encryptData(dataToEncrypt, masterPassword);
      
      const payload = {
        type: 'course',
        title: formData.platform,
        encryptedData,
        favorite: false
      };

      if (formData.id) {
        await axios.put(`${API_URL}/api/vault/${formData.id}`, payload, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/api/vault`, payload, { withCredentials: true });
      }
      
      setIsModalOpen(false);
      setFormData({ id: '', platform: '', url: '', username: '', password: '', notes: '' });
      fetchItems();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan Data Kursus');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: CourseItem) => {
    setFormData({
      id: item.id,
      platform: item.title,
      url: item.decryptedData?.url || '',
      username: item.decryptedData?.username || '',
      password: item.decryptedData?.password || '',
      notes: item.decryptedData?.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus Data Kursus ini?')) return;
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
    (item.decryptedData?.notes && item.decryptedData.notes.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-bold text-text-primary">Course Tracker</h2>
        <button 
          onClick={() => { setFormData({ id: '', platform: '', url: '', username: '', password: '', notes: '' }); setIsModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-transform active:scale-95 shadow-[0_0_10px_rgba(var(--color-primary),0.3)] text-xs"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Add Course</span>
          <span className="sm:hidden">Baru</span>
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
        <input 
          type="text" 
          placeholder="Cari kursus..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-text-muted/50 backdrop-blur-sm"
        />
      </div>

      <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-y-auto backdrop-blur-sm p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <RefreshCw className="animate-spin" size={20} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-text-muted py-10 opacity-50">
            <GraduationCap size={32} className="mb-2" />
            <p className="text-xs">Belum ada akses kursus.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-surface border border-border rounded-lg p-3 hover:border-primary/50 transition-colors group relative flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary/20 to-secondary/20 text-white flex items-center justify-center">
                      <BookOpen size={14} className="text-secondary" />
                    </div>
                    <div>
                      <h3 className="text-text-primary font-semibold text-sm leading-tight">{item.title}</h3>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)} className="text-text-muted hover:text-text-primary p-1"><MoreVertical size={14}/></button>
                    <button onClick={() => handleDelete(item.id)} className="text-danger hover:text-danger/80 p-1"><X size={14}/></button>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex flex-col gap-1 mb-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted text-[10px]">User</span>
                      <div className="flex items-center gap-1">
                        <span className="text-text-primary truncate max-w-[120px]">{item.decryptedData?.username || '-'}</span>
                        {item.decryptedData?.username && (
                           <button onClick={() => copyToClipboard(item.decryptedData?.username)} className="text-text-muted hover:text-primary"><Copy size={12}/></button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted text-[10px]">Pass</span>
                      <div className="flex items-center gap-1">
                        <span className="text-text-primary">••••••••</span>
                        {item.decryptedData?.password && (
                           <button onClick={() => copyToClipboard(item.decryptedData?.password)} className="text-text-muted hover:text-primary"><Copy size={12}/></button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {item.decryptedData?.notes && (
                    <div className="text-[10px] text-text-muted bg-black/5 dark:bg-black/30 p-1.5 rounded line-clamp-1 mb-2">
                      {item.decryptedData.notes}
                    </div>
                  )}
                </div>

                {item.decryptedData?.url && (
                  <a 
                    href={item.decryptedData.url.startsWith('http') ? item.decryptedData.url : `https://${item.decryptedData.url}`}
                    target="_blank" rel="noopener noreferrer"
                    className="w-full bg-primary/10 hover:bg-primary/20 text-primary py-1.5 rounded border border-primary/20 flex items-center justify-center gap-1.5 transition-colors text-[10px] font-medium mt-auto"
                  >
                    <ExternalLink size={10} /> Buka
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-3 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary">{formData.id ? 'Edit Akses Kursus' : 'Tambah Akses Kursus'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-3 flex flex-col gap-2">
              <div>
                <label className="text-[10px] font-medium text-text-muted mb-0.5 block">Platform (Contoh: Udemy, Coursera)</label>
                <input 
                  type="text" required value={formData.platform}
                  onChange={e => setFormData({...formData, platform: e.target.value})}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-text-muted mb-0.5 block">URL Login</label>
                <input 
                  type="url" value={formData.url}
                  onChange={e => setFormData({...formData, url: e.target.value})}
                  placeholder="https://udemy.com"
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-text-muted mb-0.5 block">Username / Email</label>
                  <input 
                    type="text" value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-text-muted mb-0.5 block">Password</label>
                  <input 
                    type="password" value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-medium text-text-muted mb-0.5 block">Catatan Progress / Lainnya (Opsional)</label>
                <textarea 
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  rows={2}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium text-xs">Batal</button>
                <button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium shadow-md text-xs">
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