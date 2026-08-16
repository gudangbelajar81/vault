import React, { useEffect, useState } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { Plus, Search, MoreVertical, Copy, Eye, EyeOff, Shield, X, RefreshCw, Key, ExternalLink, Trash2, Mail , Fingerprint, DollarSign, Server } from 'lucide-react';
import axios from 'axios';
import { encryptData, decryptData } from '../utils/crypto';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

interface ApiItem {
  id: string;
  name: string;
  key: string;
}

interface AccountItem {
  id: string;
  email: string;
  password: string;
  apis: ApiItem[];
}

interface VaultItem {
  id: string;
  type: string;
  title: string;
  favorite: boolean;
  decryptedData?: any;
  encryptedData: string;
}

export const ApiKeys = () => {
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [formShowEmail, setFormShowEmail] = useState<Record<string, boolean>>({});
  const [formShowPassword, setFormShowPassword] = useState<Record<string, boolean>>({});
  const [formShowApi, setFormShowApi] = useState<Record<string, boolean>>({});
  
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    url: '',
    accounts: [] as AccountItem[],
    notes: '',
  });

  const fetchItems = async () => {
    if (!masterPassword) return;
    try {
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      const apiItems = (res.data.data || []).filter((i: any) => i.type === 'api_key');
      
      const decrypted = await Promise.all(
        apiItems.map(async (item: VaultItem) => {
          try {
            const dataStr = await decryptData(item.encryptedData, masterPassword);
            item.decryptedData = JSON.parse(dataStr);
          } catch (e) {
            item.decryptedData = { title: 'Error', accounts: [], notes: '' };
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

  const copyToClipboard = (text: string, label: string) => {
    if (!text) {
      toast.error(`${label} kosong`);
      return;
    }
    navigator.clipboard.writeText(text);
    if (navigator.vibrate) navigator.vibrate(30);
    toast.success(`${label} disalin!`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;
    setSaving(true);
    
    try {
      const dataToEncrypt = JSON.stringify({
        title: formData.title,
        url: formData.url,
        accounts: formData.accounts,
        notes: formData.notes
      });
      
      const encryptedData = await encryptData(dataToEncrypt, masterPassword);
      
      const payload = {
        type: 'api_key',
        title: formData.title,
        encryptedData,
        favorite: false
      };

      if (formData.id) {
        await axios.put(`${API_URL}/api/vault/${formData.id}`, payload, { withCredentials: true });
        toast.success('Berhasil mengubah API Key');
      } else {
        await axios.post(`${API_URL}/api/vault`, payload, { withCredentials: true });
        toast.success('Berhasil menyimpan API Key');
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan API Key');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      title: '',
      url: '',
      accounts: [{
        id: Date.now().toString(),
        email: '',
        password: '',
        apis: [{ id: Date.now().toString() + '1', name: '', key: '' }]
      }],
      notes: ''
    });
    setFormShowEmail({});
    setFormShowPassword({});
    setFormShowApi({});
  };

  const openEdit = (item: VaultItem) => {
    const dec = item.decryptedData || {};
    let accounts = dec.accounts || [];
    
    if (accounts.length === 0 && dec.apiKey) {
      accounts = [{
        id: Date.now().toString(),
        email: '',
        password: '',
        apis: [{ id: Date.now().toString() + '1', name: dec.platform || 'API', key: dec.apiKey }]
      }];
    } else if (accounts.length === 0) {
      accounts = [{
        id: Date.now().toString(),
        email: '',
        password: '',
        apis: [{ id: Date.now().toString() + '1', name: '', key: '' }]
      }];
    }

    setFormData({
      id: item.id,
      title: item.title || dec.title || dec.platform || '',
      url: dec.url || '',
      accounts,
      notes: dec.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus API Key ini?')) return;
    try {
      await axios.delete(`${API_URL}/api/vault/${id}`, { withCredentials: true });
      toast.success('Berhasil menghapus data');
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus data');
    }
  };

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(search.toLowerCase()) || 
    (item.decryptedData?.notes && item.decryptedData.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const addAccount = () => {
    setFormData(prev => ({
      ...prev,
      accounts: [
        ...prev.accounts, 
        { 
          id: Date.now().toString(), 
          email: '', 
          password: '', 
          apis: [{ id: Date.now().toString() + '1', name: '', key: '' }] 
        }
      ]
    }));
  };

  const removeAccount = (accId: string) => {
    setFormData(prev => ({
      ...prev,
      accounts: prev.accounts.filter(a => a.id !== accId)
    }));
  };

  const addApiToAccount = (accId: string) => {
    setFormData(prev => ({
      ...prev,
      accounts: prev.accounts.map(acc => 
        acc.id === accId 
          ? { ...acc, apis: [...acc.apis, { id: Date.now().toString(), name: '', key: '' }] } 
          : acc
      )
    }));
  };

  const removeApiFromAccount = (accId: string, apiId: string) => {
    setFormData(prev => ({
      ...prev,
      accounts: prev.accounts.map(acc => 
        acc.id === accId 
          ? { ...acc, apis: acc.apis.filter(api => api.id !== apiId) } 
          : acc
      )
    }));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-bold text-text-primary">Pengelola Kunci API</h2>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-transform active:scale-95 shadow-[0_0_10px_rgba(var(--color-primary),0.3)] text-xs"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Kunci API Baru</span>
          <span className="sm:hidden">Baru</span>
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
        <input 
          type="text" 
          placeholder="Cari Kunci API..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-text-muted/50 backdrop-blur-sm"
        />
      </div>

      <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-y-auto backdrop-blur-sm p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <RefreshCw className="animate-spin" size={20} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-text-muted py-10 opacity-50">
            <Key size={32} className="mb-2" />
            <p className="text-xs">Belum ada Kunci API.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
            {filteredItems.map(item => {
              const dec = item.decryptedData || {};
              const accounts = dec.accounts || [];
              
              let viewApis: { id: string, name: string, key: string }[] = [];
              if (accounts.length > 0) {
                accounts.forEach((acc: any) => {
                  (acc.apis || []).forEach((api: any) => {
                    viewApis.push({ id: api.id || Date.now().toString() + Math.random(), name: api.name || 'API', key: api.key || '' });
                  });
                });
              } else if (dec.apiKey) {
                viewApis.push({ id: item.id, name: dec.platform || 'API', key: dec.apiKey });
              }

              return (
              <div key={item.id} className="bg-surface border border-border rounded-lg p-3 hover:border-primary/50 transition-colors group relative flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1">
                    <div className="h-8 w-8 rounded-md bg-primary/20 text-primary flex items-center justify-center shrink-0">
                      <Key size={14} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold text-sm leading-tight truncate">{item.title}</h3>
                      {dec.url && (
                        <a href={dec.url.startsWith('http') ? dec.url : `https://${dec.url}`} target="_blank" rel="noreferrer" className="text-[10px] text-info hover:underline flex items-center gap-1 mt-0.5 truncate">
                          {dec.url} <ExternalLink size={8} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(item)} className="text-text-muted hover:text-white p-1"><MoreVertical size={14}/></button>
                    <button onClick={() => handleDelete(item.id)} className="text-danger hover:text-danger/80 p-1"><X size={14}/></button>
                  </div>
                </div>

                <div className="flex-1 space-y-2 mt-2">
                  {viewApis.length === 0 ? (
                    <div className="text-[10px] text-text-muted italic">Tidak ada API Key</div>
                  ) : (
                    viewApis.map(api => (
                      <div key={api.id} className="bg-black/40 rounded-md p-2 flex items-center justify-between border border-border/50">
                        <div className="min-w-0 flex-1 mr-2">
                           <div className="text-[9px] text-text-muted mb-0 truncate">{api.name}</div>
                           <div className="font-mono text-xs text-text-primary truncate">
                             {showKey[api.id] ? api.key : '••••••••••••••••'}
                           </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button 
                            onClick={() => setShowKey({ ...showKey, [api.id]: !showKey[api.id] })}
                            className="text-text-muted hover:text-white p-1"
                          >
                            {showKey[api.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button 
                            onClick={() => copyToClipboard(api.key, 'API Key')}
                            className="text-text-muted hover:text-primary p-1"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {dec.notes && (
                  <p className="text-[10px] text-text-muted line-clamp-2 mt-3 pt-2 border-t border-border/50">{dec.notes}</p>
                )}
              </div>
            )})}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-1 sm:p-4">
          <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-3 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary">{formData.id ? 'Edit Data API' : 'Tambah Data API'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-2 flex-1 overflow-y-auto flex flex-col gap-1">
              
              <div className="grid grid-cols-12 gap-1">
                {/* 1. Nama */}
                <div className="col-span-12 md:col-span-6">
<input 
                    type="text" required value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>

                {/* 2. Link Web */}
                <div className="col-span-12 md:col-span-6">
<div className="flex gap-1">
                    <input 
                      type="url" placeholder="Link Web (Opsional)"
                      value={formData.url}
                      onChange={e => setFormData({...formData, url: e.target.value})}
                      
                      className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        if (formData.url) {
                          window.open(formData.url.startsWith('http') ? formData.url : `https://${formData.url}`, '_blank');
                        }
                      }}
                      disabled={!formData.url}
                      className="bg-surface border border-border hover:bg-surface/80 text-info px-2.5 rounded-lg transition-colors flex items-center justify-center shrink-0 disabled:opacity-50"
                      title="Buka Link Web"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Accounts List */}
              <div className="space-y-4">
                {formData.accounts.map((acc, accIdx) => (
                  <div key={acc.id} className="p-3 bg-black/5 dark:bg-black/20 border border-border/50 rounded-xl relative">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-border/30">
                      <h4 className="text-[11px] font-bold text-text-primary flex items-center gap-1">
                        <Mail size={12} className="text-primary" /> Akun Gmail & API {accIdx + 1}
                      </h4>
                      <button 
                        type="button" 
                        onClick={() => removeAccount(acc.id)}
                        className="text-danger hover:bg-danger/10 px-2 py-1 rounded text-[10px] font-medium transition-colors"
                      >
                        Hapus Akun
                      </button>
                    </div>

                    {/* 3. Akun Gmail dan Password */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-4">
                      <div className="col-span-12 md:col-span-6">
<div className="flex gap-1">
                          <div className="relative flex-1">
                            <input 
                              type={formShowEmail[acc.id] === false ? "password" : "text"} 
                              value={acc.email}
                              onChange={(e) => {
                                const newAccs = [...formData.accounts];
                                newAccs[accIdx].email = e.target.value;
                                setFormData({...formData, accounts: newAccs});
                              }}
                              
                              className="w-full bg-surface/50 border border-border rounded-lg px-2.5 py-1.5 pr-7 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                            <button 
                              type="button" 
                              onClick={() => setFormShowEmail(prev => ({...prev, [acc.id]: prev[acc.id] === false ? true : false}))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
                            >
                              {formShowEmail[acc.id] === false ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => copyToClipboard(acc.email, 'Gmail')}
                            className="bg-surface border border-border hover:bg-surface/80 text-text-muted hover:text-primary px-2 rounded-lg transition-colors shrink-0"
                          >
                            <Copy size={12} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              if (formData.url) {
                                window.open(formData.url.startsWith('http') ? formData.url : `https://${formData.url}`, '_blank');
                              } else {
                                window.open('https://mail.google.com', '_blank');
                              }
                            }}
                            className="bg-surface border border-border hover:bg-surface/80 text-primary px-2 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                            title="Akses Web / Gmail"
                          >
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="col-span-12 md:col-span-6">
<div className="flex gap-1">
                          <div className="relative flex-1">
                            <input 
                              type={formShowPassword[acc.id] === false ? "password" : "text"} 
                              placeholder="Password"
                          value={acc.password}
                              onChange={(e) => {
                                const newAccs = [...formData.accounts];
                                newAccs[accIdx].password = e.target.value;
                                setFormData({...formData, accounts: newAccs});
                              }}
                              
                              className="w-full bg-surface/50 border border-border rounded-lg px-2.5 py-1.5 pr-7 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                            <button 
                              type="button" 
                              onClick={() => setFormShowPassword(prev => ({...prev, [acc.id]: prev[acc.id] === false ? true : false}))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
                            >
                              {formShowPassword[acc.id] === false ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => copyToClipboard(acc.password, 'Password')}
                            className="bg-surface border border-border hover:bg-surface/80 text-text-muted hover:text-primary px-2 rounded-lg transition-colors shrink-0"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 4. Nama API dan API Key List */}
                    <div className="space-y-2 pl-2 md:pl-4 border-l-2 border-primary/20">
                      <label className="text-[10px] font-bold text-info uppercase tracking-wider block mb-1">Daftar API Key</label>
                      
                      {acc.apis.map((api, apiIdx) => (
                        <div key={api.id} className="flex flex-col md:flex-row gap-1 items-end">
                          <div className="col-span-5 md:col-span-5">
                                <input type="text" placeholder="Nama API"
                                value={api.name}
                              onChange={(e) => {
                                const newAccs = [...formData.accounts];
                                newAccs[accIdx].apis[apiIdx].name = e.target.value;
                                setFormData({...formData, accounts: newAccs});
                              }}
                              
                              className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                          </div>
                          <div className="col-span-12 md:col-span-6">
<div className="flex gap-1">
                              <div className="relative flex-1">
                                <input 
                                  type={formShowApi[api.id] === false ? "password" : "text"} 
                                  placeholder="API Key"
                                value={api.key}
                                  onChange={(e) => {
                                    const newAccs = [...formData.accounts];
                                    newAccs[accIdx].apis[apiIdx].key = e.target.value;
                                    setFormData({...formData, accounts: newAccs});
                                  }}
                                  
                                  className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1.5 pr-7 text-xs text-text-primary font-mono focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                />
                                <button 
                                  type="button" 
                                  onClick={() => setFormShowApi(prev => ({...prev, [api.id]: prev[api.id] === false ? true : false}))}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
                                >
                                  {formShowApi[api.id] === false ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => copyToClipboard(api.key, 'API Key')}
                                className="bg-surface border border-border hover:bg-surface/80 text-text-muted hover:text-primary px-1.5 rounded-lg transition-colors shrink-0"
                              >
                                <Copy size={12} />
                              </button>
                              <button 
                                type="button" 
                                onClick={() => removeApiFromAccount(acc.id, api.id)}
                                className="bg-danger/10 border border-danger/20 hover:bg-danger/20 text-danger px-1.5 rounded-lg transition-colors shrink-0"
                                title="Hapus API"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button 
                        type="button"
                        onClick={() => addApiToAccount(acc.id)}
                        className="mt-1 w-fit border border-dashed border-border hover:border-info/50 text-text-muted hover:text-info bg-transparent hover:bg-info/5 px-3 py-1 rounded-lg transition-colors text-[10px] font-medium flex items-center gap-1"
                      >
                        <Plus size={10} /> Tambah API Key Lainnya
                      </button>
                    </div>

                  </div>
                ))}

                <button 
                  type="button"
                  onClick={addAccount}
                  className="w-full border border-dashed border-primary/40 hover:border-primary/80 text-primary hover:text-white bg-primary/5 hover:bg-primary/20 py-2 rounded-xl transition-colors text-[11px] font-bold flex items-center justify-center gap-1 mt-2"
                >
                  <Plus size={14} /> Tambah Akun Baru (beserta API-nya)
                </button>
              </div>

              {/* 5. Note */}
              <div>
                <textarea 
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="Catatan / Note"
                      rows={2}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

            </form>

            <div className="p-3 border-t border-border flex justify-end gap-1 bg-surface/30">
              <button 
                type="button" onClick={() => setIsModalOpen(false)} 
                className="px-4 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium text-xs"
              >
                Batal
              </button>
              <button 
                type="button" onClick={handleSave} disabled={saving || !formData.title} 
                className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium shadow-md text-xs"
              >
                {saving ? 'Menyimpan...' : 'Simpan Kunci API'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
