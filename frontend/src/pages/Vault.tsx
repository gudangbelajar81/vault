import React, { useEffect, useState, useRef } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { Plus, Search, MoreVertical, Copy, ExternalLink, Eye, EyeOff, Shield, X, RefreshCw, Star, Upload } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';
import { encryptData, decryptData } from '../utils/crypto';
import Papa from 'papaparse';

export const Vault = () => {
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    favorite: false
  });
  const [showFormPassword, setShowFormPassword] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      // Use proxy or full URL
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      if (res.data.success && masterPassword) {
        // Decrypt all items
        const decryptedItems = await Promise.all(res.data.data.map(async (item: any) => {
          try {
            const decStr = await decryptData(item.encryptedData, masterPassword);
            const decData = JSON.parse(decStr);
            return { ...item, decrypted: decData };
          } catch (e) {
            console.error('Decryption failed for item', item.id);
            return { ...item, decrypted: { error: 'Gagal mendekripsi' } };
          }
        }));
        setItems(decryptedItems);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password: result });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;

    setSaving(true);
    try {
      const dataToEncrypt = JSON.stringify({
        username: formData.username,
        password: formData.password,
        url: formData.url,
        notes: formData.notes
      });

      const encryptedData = await encryptData(dataToEncrypt, masterPassword);

      await axios.post(`${API_URL}/api/vault`, {
        type: 'password',
        title: formData.title,
        encryptedData,
        favorite: formData.favorite
      }, { withCredentials: true });

      setIsModalOpen(false);
      setFormData({ title: '', username: '', password: '', url: '', notes: '', favorite: false });
      fetchItems();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !masterPassword) return;

    setImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const itemsToEncrypt = results.data.map((row: any) => {
            // Mapping default Chrome CSV format: name, url, username, password, note
            return {
              title: row.name || row.title || 'Imported Item',
              url: row.url || '',
              username: row.username || row.email || '',
              password: row.password || '',
              notes: row.note || row.notes || '',
            };
          });

          // Encrypt everything
          const encryptedItems = await Promise.all(
            itemsToEncrypt.map(async (item) => {
              const dataToEncrypt = JSON.stringify({
                username: item.username,
                password: item.password,
                url: item.url,
                notes: item.notes
              });
              const encryptedData = await encryptData(dataToEncrypt, masterPassword);
              return {
                type: 'password',
                title: item.title,
                encryptedData,
                favorite: false
              };
            })
          );

          // Send to backend bulk API
          await axios.post(`${API_URL}/api/vault`, { items: encryptedItems }, { withCredentials: true });
          
          alert(`Berhasil mengimpor ${encryptedItems.length} data password!`);
          fetchItems();
        } catch (error) {
          console.error(error);
          alert('Gagal mengimpor data CSV.');
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Password Vault</h2>
          <p className="text-text-muted text-sm mt-1">Manage your secure credentials.</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef}
            className="hidden" 
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="bg-surface hover:bg-surface/80 border border-border text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
            title="Import from Chrome CSV"
          >
            <Upload size={18} />
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-transform active:scale-95 shadow-[0_0_15px_rgba(var(--color-primary),0.3)]"
          >
            <Plus size={18} />
            New Item
          </button>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search vault..." 
            className="w-full bg-surface/50 border border-border rounded-lg pl-10 pr-4 py-2 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* Vault List */}
      <div className="flex-1 bg-surface/50 border border-border rounded-2xl overflow-hidden backdrop-blur-xl flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col text-text-muted p-4 text-center">
            <Shield size={48} className="mb-4 opacity-50" />
            <p>Vault masih kosong. Tambahkan item pertama Anda.</p>
          </div>
        ) : (
          <div className="overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface/80 border-b border-border sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-4 py-3 md:px-6 md:py-4 text-[10px] md:text-xs font-semibold text-text-muted uppercase tracking-wider">Title</th>
                  <th className="hidden md:table-cell px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Username</th>
                  <th className="hidden lg:table-cell px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Updated</th>
                  <th className="px-4 py-3 md:px-6 md:py-4 text-right text-[10px] md:text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-3 md:px-6 md:py-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm md:text-base shrink-0">
                          {item.title.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 md:gap-2">
                            <p className="font-medium text-text-primary text-sm md:text-base truncate">{item.title}</p>
                            {item.favorite && <Star size={10} className="text-warning fill-warning shrink-0 md:w-3 md:h-3" />}
                          </div>
                          {/* Show username on mobile below title */}
                          <div className="md:hidden text-[10px] text-text-muted truncate mt-0.5">
                            {item.decrypted?.username || 'No username'}
                          </div>
                          {item.decrypted?.url && (
                            <a href={item.decrypted.url} target="_blank" rel="noreferrer" className="text-[10px] md:text-xs text-info hover:underline flex items-center gap-1 mt-0.5 truncate">
                              {item.decrypted.url} <ExternalLink size={8} className="md:w-[10px] md:h-[10px]" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-text-muted text-sm">
                      {item.decrypted?.username || '-'}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 text-text-muted text-sm">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 text-right">
                      <div className="flex items-center justify-end gap-1 md:gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            if (item.decrypted?.password) {
                              navigator.clipboard.writeText(item.decrypted.password);
                              // Haptic feedback (Protocol 20)
                              if (navigator.vibrate) navigator.vibrate(30);
                              alert('Password berhasil disalin!');
                            }
                          }}
                          className="p-1.5 md:p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Copy Password"
                        >
                          <Copy size={14} className="md:w-4 md:h-4" />
                        </button>
                        <button className="p-1.5 md:p-2 text-text-muted hover:text-text-primary hover:bg-white/10 rounded-lg transition-colors">
                          <MoreVertical size={14} className="md:w-4 md:h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-white">Add New Vault Item</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Title *</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  placeholder="e.g. Netflix, Github, Bank..."
                  className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Username / Email</label>
                <input 
                  type="text" 
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="johndoe / john@example.com"
                  className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Password</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type={showFormPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 pr-10 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
                    >
                      {showFormPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button 
                    type="button"
                    onClick={generatePassword}
                    className="bg-surface border border-border hover:bg-surface/80 text-primary px-3 rounded-lg transition-colors flex items-center gap-1"
                    title="Generate Random Password"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Website URL</label>
                <input 
                  type="url" 
                  value={formData.url}
                  onChange={(e) => setFormData({...formData, url: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Notes (Secure)</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                  className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="favorite"
                  checked={formData.favorite}
                  onChange={(e) => setFormData({...formData, favorite: e.target.checked})}
                  className="rounded border-border bg-black text-primary focus:ring-primary focus:ring-offset-0 h-4 w-4"
                />
                <label htmlFor="favorite" className="text-sm text-text-muted cursor-pointer select-none">
                  Mark as Favorite
                </label>
              </div>
            </form>

            <div className="p-6 border-t border-border flex justify-end gap-3 bg-surface/30">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving || !formData.title}
                className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium shadow-md"
              >
                {saving ? 'Encrypting...' : 'Save securely'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
