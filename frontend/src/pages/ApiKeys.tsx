import React, { useEffect, useState } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { Plus, Search, MoreVertical, Copy, Eye, EyeOff, Shield, X, RefreshCw, Key } from 'lucide-react';
import axios from 'axios';
import { encryptData, decryptData } from '../utils/crypto';
import { API_URL } from '../config';

interface ApiKeyItem {
  id: string;
  type: string;
  title: string;
  favorite: boolean;
  decryptedData?: any;
  encryptedData: string;
}

export const ApiKeys = () => {
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  
  // Form State
  const [formData, setFormData] = useState({
    id: '',
    platform: '',
    apiKey: '',
    notes: '',
  });

  const fetchItems = async () => {
    if (!masterPassword) return;
    try {
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      const apiItems = (res.data.data || []).filter((i: any) => i.type === 'api_key');
      
      const decrypted = await Promise.all(
        apiItems.map(async (item: ApiKeyItem) => {
          try {
            const dataStr = await decryptData(item.encryptedData, masterPassword);
            item.decryptedData = JSON.parse(dataStr);
          } catch (e) {
            item.decryptedData = { platform: 'Error', apiKey: 'Decryption failed', notes: '' };
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
    // Vibrate success
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;
    setSaving(true);
    
    try {
      const dataToEncrypt = JSON.stringify({
        platform: formData.platform,
        apiKey: formData.apiKey,
        notes: formData.notes
      });
      
      const encryptedData = await encryptData(dataToEncrypt, masterPassword);
      
      const payload = {
        type: 'api_key',
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
      setFormData({ id: '', platform: '', apiKey: '', notes: '' });
      fetchItems();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan API Key');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: ApiKeyItem) => {
    setFormData({
      id: item.id,
      platform: item.title,
      apiKey: item.decryptedData?.apiKey || '',
      notes: item.decryptedData?.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus API Key ini?')) return;
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">API Key Manager</h2>
          <p className="text-text-muted text-sm mt-1">Simpan kunci rahasia integrasi aplikasi Anda.</p>
        </div>
        <button 
          onClick={() => { setFormData({ id: '', platform: '', apiKey: '', notes: '' }); setIsModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-transform active:scale-95 shadow-[0_0_15px_rgba(var(--color-primary),0.3)]"
        >
          <Plus size={18} />
          New API Key
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
        <input 
          type="text" 
          placeholder="Cari API Keys..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface/50 border border-border rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-text-muted/50 backdrop-blur-sm"
        />
      </div>

      <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-hidden backdrop-blur-sm p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <RefreshCw className="animate-spin" size={24} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col text-text-muted h-full opacity-50">
            <Key size={48} className="mb-4" />
            <p>Belum ada API Key tersimpan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-surface border border-border rounded-xl p-4 hover:border-primary/50 transition-colors group relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                      <Key size={20} />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{item.title}</h3>
                      <p className="text-xs text-text-muted">API Key</p>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button onClick={() => openEdit(item)} className="text-text-muted hover:text-white"><MoreVertical size={16}/></button>
                    <button onClick={() => handleDelete(item.id)} className="text-danger hover:text-danger/80"><X size={16}/></button>
                  </div>
                </div>

                <div className="bg-black/40 rounded-lg p-3 flex items-center justify-between mb-3 border border-border/50">
                  <span className="font-mono text-sm text-text-muted truncate mr-2">
                    {showKey[item.id] ? item.decryptedData?.apiKey : '••••••••••••••••••••••••'}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowKey({ ...showKey, [item.id]: !showKey[item.id] })}
                      className="text-text-muted hover:text-white"
                    >
                      {showKey[item.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button 
                      onClick={() => copyToClipboard(item.decryptedData?.apiKey || '')}
                      className="text-text-muted hover:text-primary"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
                
                {item.decryptedData?.notes && (
                  <p className="text-xs text-text-muted line-clamp-2">{item.decryptedData.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-white">{formData.id ? 'Edit API Key' : 'Tambah API Key'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-white transition-colors">
                <X size={22} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Platform (Contoh: OpenAI, Stripe)</label>
                <input 
                  type="text" required value={formData.platform}
                  onChange={e => setFormData({...formData, platform: e.target.value})}
                  className="w-full bg-black/40 border border-border rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Secret API Key</label>
                <div className="relative">
                  <input 
                    type="password" required value={formData.apiKey}
                    onChange={e => setFormData({...formData, apiKey: e.target.value})}
                    className="w-full bg-black/40 border border-border rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-sm"
                  />
                  <Shield className="absolute right-4 top-1/2 -translate-y-1/2 text-success" size={18} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Catatan Tambahan (Opsional)</label>
                <textarea 
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  rows={2}
                  className="w-full bg-black/40 border border-border rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors font-medium">Batal</button>
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
