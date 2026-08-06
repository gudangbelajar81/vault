import React, { useEffect, useState, useRef } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { Plus, Search, Copy, ExternalLink, Eye, EyeOff, Shield, X, RefreshCw, Star, Upload, Trash2, Edit2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';
import { encryptData, decryptData } from '../utils/crypto';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

export const Vault = () => {
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    credentials: [{ id: Date.now().toString(), username: '', password: '' }],
    url: '',
    notes: '',
    favorite: false
  });
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

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

  const generatePassword = (id: string) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({
      ...formData,
      credentials: formData.credentials.map(c => c.id === id ? { ...c, password: result } : c)
    });
  };

  const addCredentialRow = () => {
    setFormData({
      ...formData,
      credentials: [...formData.credentials, { id: Date.now().toString(), username: '', password: '' }]
    });
  };

  const removeCredentialRow = (id: string) => {
    if (formData.credentials.length <= 1) return;
    setFormData({
      ...formData,
      credentials: formData.credentials.filter(c => c.id !== id)
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;

    setSaving(true);
    try {
      const dataToEncrypt = JSON.stringify({
        credentials: formData.credentials,
        url: formData.url,
        notes: formData.notes,
        username: formData.credentials[0]?.username || '',
        password: formData.credentials[0]?.password || '',
      });

      const encryptedData = await encryptData(dataToEncrypt, masterPassword);

      if (editingItemId) {
        await axios.put(`${API_URL}/api/vault/${editingItemId}`, {
          title: formData.title,
          encryptedData,
          favorite: formData.favorite
        }, { withCredentials: true });
        toast.success('Berhasil mengubah data');
      } else {
        await axios.post(`${API_URL}/api/vault`, {
          type: 'password',
          title: formData.title,
          encryptedData,
          favorite: formData.favorite
        }, { withCredentials: true });
        toast.success('Berhasil menyimpan data');
      }

      setIsModalOpen(false);
      setEditingItemId(null);
      setFormData({ title: '', credentials: [{ id: Date.now().toString(), username: '', password: '' }], url: '', notes: '', favorite: false });
      setVisiblePasswords({});
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus data ini secara permanen?')) return;
    try {
      await axios.delete(`${API_URL}/api/vault/${id}`, { withCredentials: true });
      toast.success('Data berhasil dihapus');
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus data');
    }
  };

  const openEditModal = (item: any) => {
    // Determine credentials format (new array or old single format)
    let creds = [{ id: Date.now().toString(), username: '', password: '' }];
    if (item.decrypted?.credentials && Array.isArray(item.decrypted.credentials)) {
      creds = item.decrypted.credentials;
    } else if (item.decrypted?.username || item.decrypted?.password) {
      creds = [{ id: Date.now().toString(), username: item.decrypted.username || '', password: item.decrypted.password || '' }];
    }

    setFormData({
      title: item.title,
      credentials: creds,
      url: item.decrypted?.url || '',
      notes: item.decrypted?.notes || '',
      favorite: item.favorite || false
    });
    setEditingItemId(item.id);
    setIsModalOpen(true);
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
          
          toast.success(`Berhasil mengimpor ${encryptedItems.length} data password!`);
          fetchItems();
        } catch (error) {
          console.error(error);
          toast.error('Gagal mengimpor data CSV.');
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-bold text-text-primary">Password Vault</h2>
        <div className="flex gap-1.5 md:gap-2">
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
            className="bg-surface hover:bg-surface/80 border border-border text-text-primary px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50 text-xs"
            title="Import from Chrome CSV"
          >
            <Upload size={12} />
            {importing ? 'Importing...' : <span className="hidden md:inline">Import CSV</span>}
          </button>
          <button 
            onClick={() => {
              setEditingItemId(null);
              setFormData({ title: '', credentials: [{ id: Date.now().toString(), username: '', password: '' }], url: '', notes: '', favorite: false });
              setIsModalOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-white px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-transform active:scale-95 shadow-[0_0_10px_rgba(var(--color-primary),0.3)] text-xs"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">New Item</span>
            <span className="sm:hidden">Baru</span>
          </button>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex gap-4 mb-3">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search vault..." 
            className="w-full bg-surface/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* Vault List */}
      <div className="flex-1 bg-surface/50 border border-border rounded-lg overflow-hidden backdrop-blur-xl flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col text-text-muted py-10 opacity-50">
            <Shield size={32} className="mb-2" />
            <p className="text-xs">Vault masih kosong.</p>
          </div>
        ) : (
          <div className="overflow-y-auto">
            <table className="w-full text-left border-collapse block md:table">
              <thead className="bg-surface/80 border-b border-border sticky top-0 z-10 backdrop-blur-md hidden md:table-header-group">
                <tr>
                  <th className="px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Title</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Username</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Updated</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border block md:table-row-group">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group flex md:table-row items-center justify-between py-2 px-2 md:py-0 md:px-0 border-b border-border/50 md:border-none">
                    <td className="flex-1 md:flex-none p-0 md:px-3 md:py-2 cursor-pointer group-hover:bg-black/5 dark:group-hover:bg-white/5" onClick={() => openEditModal(item)}>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {item.title.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <p className="font-semibold text-text-primary text-xs truncate leading-tight">{item.title}</p>
                            {item.favorite && <Star size={10} className="text-warning fill-warning shrink-0" />}
                          </div>
                          {/* Username on mobile */}
                          <div className="md:hidden text-[10px] text-text-muted truncate leading-tight">
                            {item.decrypted?.username || 'No username'}
                          </div>
                          {/* URL on desktop only */}
                          {item.decrypted?.url && (
                            <a href={item.decrypted.url} target="_blank" rel="noreferrer" className="hidden md:flex text-xs text-info hover:underline items-center gap-1 mt-0.5 truncate leading-tight">
                              {item.decrypted.url} <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-text-muted text-sm">
                      {item.decrypted?.username || '-'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-text-muted text-sm">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="flex-none p-0 md:px-6 md:py-4 text-right">
                      <div className="flex items-center justify-end gap-0.5 md:gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            const pwToCopy = item.decrypted?.password || item.decrypted?.credentials?.[0]?.password;
                            if (pwToCopy) {
                              navigator.clipboard.writeText(pwToCopy);
                              if (navigator.vibrate) navigator.vibrate(30);
                              toast.success('Password disalin!');
                            } else {
                              toast.error('Tidak ada password untuk disalin');
                            }
                          }}
                          className="p-1 md:p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Copy Password"
                        >
                          <Copy size={14} className="md:w-4 md:h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                          className="p-1 md:p-2 text-text-muted hover:text-info hover:bg-info/10 rounded-lg transition-colors"
                          title="Edit Item"
                        >
                          <Edit2 size={14} className="md:w-4 md:h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          className="p-1 md:p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 size={14} className="md:w-4 md:h-4" />
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
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-3 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary">{editingItemId ? 'Edit Vault Item' : 'Add New Vault Item'}</h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingItemId(null);
                }}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-3 flex-1 overflow-y-auto flex flex-col gap-2">
              <div>
                <label className="text-[10px] font-medium text-text-muted mb-0.5 block">Title *</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  placeholder="e.g. Netflix, Github, Bank..."
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="space-y-3">
                {formData.credentials.map((cred, index) => (
                  <div key={cred.id} className="p-2.5 bg-black/5 dark:bg-black/20 border border-border/50 rounded-xl relative group">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Credential {index + 1}</span>
                      {formData.credentials.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeCredentialRow(cred.id)}
                          className="text-danger hover:bg-danger/10 p-1 rounded transition-colors"
                          title="Hapus baris ini"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <input 
                          type="text" 
                          value={cred.username}
                          onChange={(e) => {
                            const newCreds = [...formData.credentials];
                            newCreds[index].username = e.target.value;
                            setFormData({...formData, credentials: newCreds});
                          }}
                          placeholder="Username / Email"
                          className="w-full bg-surface/50 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <input 
                            type={visiblePasswords[cred.id] ? "text" : "password"}
                            value={cred.password}
                            onChange={(e) => {
                              const newCreds = [...formData.credentials];
                              newCreds[index].password = e.target.value;
                              setFormData({...formData, credentials: newCreds});
                            }}
                            placeholder="Password"
                            className="w-full bg-surface/50 border border-border rounded-lg px-2.5 py-1.5 pr-7 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                          />
                          <button 
                            type="button" 
                            onClick={() => setVisiblePasswords(prev => ({...prev, [cred.id]: !prev[cred.id]}))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
                          >
                            {visiblePasswords[cred.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                        <button 
                          type="button"
                          onClick={() => generatePassword(cred.id)}
                          className="bg-surface border border-border hover:bg-surface/80 text-primary px-2 rounded-lg transition-colors flex items-center justify-center shrink-0"
                          title="Generate Password"
                        >
                          <RefreshCw size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                <button 
                  type="button"
                  onClick={addCredentialRow}
                  className="w-full border border-dashed border-border hover:border-primary/50 text-text-muted hover:text-primary bg-transparent hover:bg-primary/5 py-1.5 rounded-xl transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <Plus size={12} />
                  Tambah Baris Akun
                </button>
              </div>

              <div>
                <label className="text-[10px] font-medium text-text-muted mb-0.5 block">Website URL</label>
                <input 
                  type="url" 
                  value={formData.url}
                  onChange={(e) => setFormData({...formData, url: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-text-muted mb-0.5 block">Notes (Secure)</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={2}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-1.5 mt-1">
                <input 
                  type="checkbox" 
                  id="favorite"
                  checked={formData.favorite}
                  onChange={(e) => setFormData({...formData, favorite: e.target.checked})}
                  className="rounded border-border bg-black/10 dark:bg-black text-primary focus:ring-primary focus:ring-offset-0 h-3 w-3"
                />
                <label htmlFor="favorite" className="text-[10px] text-text-muted cursor-pointer select-none">
                  Mark as Favorite
                </label>
              </div>
            </form>

            <div className="p-3 border-t border-border flex justify-end gap-2 bg-surface/30">
              <button 
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingItemId(null);
                }}
                className="px-4 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium text-xs"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving || !formData.title}
                className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium shadow-md text-xs"
              >
                {saving ? 'Encrypting...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
