import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useVaultStore } from '../store/vaultStore';
import { decryptData, encryptData } from '../utils/crypto';
import { Network, Mail, Key, CreditCard, GraduationCap, X, Edit2, Trash2, Globe, Shield, Plus, Copy, ExternalLink, Check } from 'lucide-react';
import { API_URL } from '../config';

interface MappedNode {
  id: string;
  type: string; // 'password', 'course', 'api_key', 'subscription', 'shortcut'
  title: string;
  email: string;
  raw: any; 
  password?: string; // extracted for quick copy
  url?: string;
}

export const IdentityMap = () => {
  const { masterPassword } = useVaultStore();
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<MappedNode[]>([]);
  
  // Modals
  const [editItem, setEditItem] = useState<MappedNode | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addType, setAddType] = useState<'vault' | 'subscription'>('vault');
  const [addFormData, setAddFormData] = useState<any>({});

  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!masterPassword) return;
    setLoading(true);
    try {
      const [vaultRes, subRes] = await Promise.all([
        axios.get(`${API_URL}/api/vault`, { withCredentials: true }),
        axios.get(`${API_URL}/api/subscriptions`, { withCredentials: true })
      ]);

      const vaultItems = vaultRes.data.data || [];
      const subscriptions = subRes.data.data || [];

      const mapped: MappedNode[] = [];

      for (const item of vaultItems) {
        try {
          const decryptedStr = await decryptData(item.encryptedData, masterPassword);
          const data = JSON.parse(decryptedStr);
          
          let email = '';
          if (item.type === 'password' || item.type === 'course') {
            email = data.username?.toLowerCase().trim() || '';
          }
          
          if (email) {
            mapped.push({
              id: item.id,
              type: item.type,
              title: item.title,
              email: email,
              password: data.password,
              url: data.url,
              raw: { ...item, decryptedData: data }
            });
          } else if (item.type === 'password' && item.title.includes('@')) {
            mapped.push({
              id: item.id,
              type: item.type,
              title: item.title,
              email: item.title.toLowerCase().trim(),
              password: data.password,
              url: data.url,
              raw: { ...item, decryptedData: data }
            });
          }
        } catch (e) {
          console.error('Failed to decrypt item for map', e);
        }
      }

      for (const sub of subscriptions) {
        if (sub.accountEmail) {
          mapped.push({
            id: sub.id,
            type: 'subscription',
            title: sub.name,
            email: sub.accountEmail.toLowerCase().trim(),
            raw: sub
          });
        }
      }

      setNodes(mapped);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [masterPassword]);

  const handleDelete = async (item: MappedNode) => {
    if (!window.confirm(`Hapus ${item.title}?`)) return;
    try {
      if (item.type === 'subscription') {
        await axios.delete(`${API_URL}/api/subscriptions/${item.id}`, { withCredentials: true });
      } else {
        await axios.delete(`${API_URL}/api/vault/${item.id}`, { withCredentials: true });
      }
      fetchData();
    } catch (error) {
      alert('Gagal menghapus');
    }
  };

  const openEdit = (item: MappedNode) => {
    setEditItem(item);
    if (item.type === 'subscription') {
      setEditFormData({ ...item.raw });
    } else {
      setEditFormData({ ...item.raw.decryptedData, title: item.title });
    }
  };

  const openAdd = (email?: string) => {
    setAddFormData(email ? { username: email, accountEmail: email } : {});
    setAddType('vault');
    setAddModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !masterPassword) return;
    setSaving(true);
    
    try {
      if (editItem.type === 'subscription') {
        await axios.put(`${API_URL}/api/subscriptions/${editItem.id}`, editFormData, { withCredentials: true });
      } else {
        const { title, ...dataToEncrypt } = editFormData;
        const encryptedStr = await encryptData(JSON.stringify(dataToEncrypt), masterPassword);
        const payload = {
          type: editItem.type,
          title: title,
          encryptedData: encryptedStr,
          favorite: editItem.raw.favorite
        };
        await axios.put(`${API_URL}/api/vault/${editItem.id}`, payload, { withCredentials: true });
      }
      setEditItem(null);
      fetchData();
    } catch (error) {
      alert('Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;
    setSaving(true);

    try {
      if (addType === 'subscription') {
        const payload = {
          name: addFormData.name || 'Langganan Baru',
          price: addFormData.price ? parseFloat(addFormData.price) : 0,
          currency: addFormData.currency || 'IDR',
          billingCycle: addFormData.billingCycle || 'monthly',
          nextBillingDate: addFormData.nextBillingDate || '',
          status: addFormData.status || 'active',
          accountEmail: addFormData.accountEmail || ''
        };
        await axios.post(`${API_URL}/api/subscriptions/bulk`, { subscriptions: [payload] }, { withCredentials: true });
      } else {
        const title = addFormData.title || 'Akun Baru';
        const type = addFormData.vaultType || 'password';
        const dataToEncrypt = { ...addFormData };
        delete dataToEncrypt.title;
        delete dataToEncrypt.vaultType;

        const encryptedStr = await encryptData(JSON.stringify(dataToEncrypt), masterPassword);
        const payload = {
          type: type,
          title: title,
          encryptedData: encryptedStr,
          favorite: false
        };
        await axios.post(`${API_URL}/api/vault`, payload, { withCredentials: true });
      }
      setAddModalOpen(false);
      fetchData();
    } catch (error) {
      alert('Gagal menambah data');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const groups = nodes.reduce((acc, curr) => {
    if (!acc[curr.email]) acc[curr.email] = [];
    acc[curr.email].push(curr);
    return acc;
  }, {} as Record<string, MappedNode[]>);

  const getIcon = (type: string) => {
    switch (type) {
      case 'password': return <Key size={14} className="text-primary" />;
      case 'course': return <GraduationCap size={14} className="text-secondary" />;
      case 'api_key': return <Shield size={14} className="text-warning" />;
      case 'subscription': return <CreditCard size={14} className="text-success" />;
      case 'shortcut': return <Globe size={14} className="text-info" />;
      default: return <Key size={14} />;
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      <div className="mb-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-md bg-primary/20 text-primary flex items-center justify-center shrink-0">
             <Network size={14} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary leading-tight">Peta Identitas (Command Center)</h2>
            <p className="text-[10px] text-text-muted leading-tight">Pusat kendali seluruh akun & langganan</p>
          </div>
        </div>
        <button onClick={() => openAdd()} className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-primary/20 flex items-center gap-1.5 transition-all">
          <Plus size={14} /> Akar Baru
        </button>
      </div>

      {/* Infinite Canvas */}
      <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-auto relative backdrop-blur-sm custom-scrollbar">
        {/* Dot Matrix Background */}
        <div className="absolute inset-0 pointer-events-none opacity-5 dark:opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted">Memuat peta...</div>
        ) : Object.keys(groups).length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted">
            <Network size={48} className="mb-4 opacity-30" />
            <p>Peta masih kosong.</p>
            <button onClick={() => openAdd()} className="mt-4 px-4 py-2 border border-border rounded-lg hover:border-primary text-xs transition-colors">Tambah Data Pertama</button>
          </div>
        ) : (
          <div className="min-w-max p-10 flex flex-col gap-12">
            {Object.entries(groups).map(([email, children]) => (
              <div key={email} className="flex items-center gap-12 group/root">
                
                {/* Root Node (Email) */}
                <div className="relative z-20 flex items-center bg-surface border border-border shadow-xl rounded-xl px-5 py-3 min-w-[220px] max-w-[300px] hover:border-primary/50 hover:shadow-primary/10 transition-all">
                  <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center mr-3 shrink-0">
                    <Mail size={16} />
                  </div>
                  <span className="font-bold text-text-primary text-sm truncate" title={email}>{email}</span>
                  
                  {/* Floating Actions on Root */}
                  <div className="absolute -right-3 -top-3 flex items-center gap-1 opacity-0 group-hover/root:opacity-100 transition-all z-30">
                     <button 
                       onClick={() => copyToClipboard(email, `email-${email}`)}
                       className="bg-surface border border-border text-text-primary p-1.5 rounded-full shadow-lg hover:text-primary transition-colors"
                       title="Salin Email"
                     >
                       {copiedId === `email-${email}` ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                     </button>
                     <button 
                       onClick={() => openAdd(email)}
                       className="bg-primary text-white p-1.5 rounded-full shadow-lg shadow-primary/30 hover:scale-110 transition-transform"
                       title="Tambah Anak"
                     >
                       <Plus size={14} />
                     </button>
                  </div>
                </div>

                {/* Branches */}
                {children.length > 0 && (
                  <div className="relative flex flex-col justify-center gap-4 py-4 min-w-[320px]">
                    
                    {/* Horizontal Line connecting Root to Spine */}
                    {children.length > 1 && <div className="absolute left-[-48px] top-1/2 -translate-y-1/2 w-[24px] h-[2px] bg-border/50"></div>}
                    {children.length === 1 && <div className="absolute left-[-48px] top-1/2 -translate-y-1/2 w-[48px] h-[2px] bg-border/50"></div>}

                    {children.map((child, idx) => (
                      <div key={child.id} className="relative flex items-center group/node min-h-[4rem]">
                        
                        {/* Spine Vertical Lines */}
                        {idx === 0 && children.length > 1 && <div className="absolute left-[-24px] top-1/2 bottom-0 w-[2px] bg-border/50 rounded-tl-full"></div>}
                        {idx === children.length - 1 && children.length > 1 && <div className="absolute left-[-24px] top-0 bottom-1/2 w-[2px] bg-border/50 rounded-bl-full"></div>}
                        {idx > 0 && idx < children.length - 1 && <div className="absolute left-[-24px] top-0 bottom-0 w-[2px] bg-border/50"></div>}

                        {/* Horizontal Line to Child */}
                        {children.length > 1 && <div className="absolute left-[-24px] w-[24px] h-[2px] bg-border/50 top-1/2 -translate-y-1/2"></div>}

                        {/* Child Card */}
                        <div className="bg-black/5 dark:bg-black/40 border border-border rounded-xl p-3 w-full hover:border-primary/50 transition-all shadow-sm hover:shadow-md relative overflow-hidden flex items-center justify-between">
                           <div className="flex items-center gap-3">
                             <div className="h-8 w-8 rounded-lg bg-surface border border-border/50 flex items-center justify-center shrink-0">
                               {getIcon(child.type)}
                             </div>
                             <div className="flex flex-col">
                               <span className="text-sm font-bold text-text-primary truncate max-w-[150px]" title={child.title}>{child.title}</span>
                               <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">{child.type}</span>
                             </div>
                           </div>

                           {/* Invisible Context Actions */}
                           <div className="absolute top-0 right-0 bottom-0 bg-gradient-to-l from-surface via-surface to-transparent pl-8 pr-3 flex items-center justify-end gap-1.5 opacity-0 group-hover/node:opacity-100 transition-all translate-x-4 group-hover/node:translate-x-0">
                               {child.password && (
                                 <button onClick={() => copyToClipboard(child.password!, `pass-${child.id}`)} className="p-1.5 bg-black/5 dark:bg-white/5 rounded-md hover:text-primary transition-colors text-text-muted" title="Salin Password">
                                   {copiedId === `pass-${child.id}` ? <Check size={14} className="text-success" /> : <Copy size={14}/>}
                                 </button>
                               )}
                               {child.url && (
                                 <a href={child.url.startsWith('http') ? child.url : `https://${child.url}`} target="_blank" rel="noreferrer" className="p-1.5 bg-black/5 dark:bg-white/5 rounded-md hover:text-primary transition-colors text-text-muted" title="Buka Link">
                                   <ExternalLink size={14}/>
                                 </a>
                               )}
                               <button onClick={() => openEdit(child)} className="p-1.5 bg-black/5 dark:bg-white/5 rounded-md hover:text-primary transition-colors text-text-muted" title="Edit">
                                 <Edit2 size={14}/>
                               </button>
                               <button onClick={() => handleDelete(child)} className="p-1.5 bg-black/5 dark:bg-white/5 rounded-md hover:bg-danger/20 hover:text-danger transition-colors text-text-muted" title="Hapus">
                                 <Trash2 size={14}/>
                               </button>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unified Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if(e.target === e.currentTarget) setEditItem(null) }}>
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2"><Edit2 size={18} className="text-primary"/> Edit {editItem.title}</h3>
              <button onClick={() => setEditItem(null)} className="text-text-muted hover:text-text-primary transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {editItem.type === 'subscription' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-text-muted mb-1 block">Nama Layanan</label>
                    <input type="text" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-text-muted mb-1 block">Harga</label>
                      <input type="number" value={editFormData.price || ''} onChange={e => setEditFormData({...editFormData, price: e.target.value ? parseFloat(e.target.value) : ''})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-text-muted mb-1 block">Mata Uang</label>
                      <select value={editFormData.currency || 'IDR'} onChange={e => setEditFormData({...editFormData, currency: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary">
                        <option value="IDR">IDR</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted mb-1 block">Email Akun</label>
                    <input type="email" value={editFormData.accountEmail || ''} onChange={e => setEditFormData({...editFormData, accountEmail: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-text-muted mb-1 block">Judul / Platform</label>
                    <input type="text" value={editFormData.title || ''} onChange={e => setEditFormData({...editFormData, title: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted mb-1 block">Username / Email</label>
                    <input type="text" value={editFormData.username || ''} onChange={e => setEditFormData({...editFormData, username: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted mb-1 block">Password</label>
                    <input type="text" value={editFormData.password || ''} onChange={e => setEditFormData({...editFormData, password: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted mb-1 block">URL (Opsional)</label>
                    <input type="text" value={editFormData.url || ''} onChange={e => setEditFormData({...editFormData, url: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 rounded-lg text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm font-bold">Batal</button>
                <button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-transform active:scale-95 text-sm font-bold shadow-md">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Add Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if(e.target === e.currentTarget) setAddModalOpen(false) }}>
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2"><Plus size={18} className="text-primary"/> Tambah Data Baru</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveAdd} className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="flex p-1 bg-black/5 dark:bg-black/40 rounded-lg">
                <button type="button" onClick={() => setAddType('vault')} className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${addType === 'vault' ? 'bg-surface shadow text-primary' : 'text-text-muted hover:text-text-primary'}`}>Vault / Akun</button>
                <button type="button" onClick={() => setAddType('subscription')} className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${addType === 'subscription' ? 'bg-surface shadow text-success' : 'text-text-muted hover:text-text-primary'}`}>Langganan</button>
              </div>

              {addType === 'subscription' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-text-muted mb-1 block">Nama Layanan *</label>
                    <input type="text" required value={addFormData.name || ''} onChange={e => setAddFormData({...addFormData, name: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted mb-1 block">Email Akun</label>
                    <input type="email" value={addFormData.accountEmail || ''} onChange={e => setAddFormData({...addFormData, accountEmail: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-text-muted mb-1 block">Harga</label>
                      <input type="number" value={addFormData.price || ''} onChange={e => setAddFormData({...addFormData, price: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-text-muted mb-1 block">Mata Uang</label>
                      <select value={addFormData.currency || 'IDR'} onChange={e => setAddFormData({...addFormData, currency: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary">
                        <option value="IDR">IDR</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-text-muted mb-1 block">Tipe Vault</label>
                      <select value={addFormData.vaultType || 'password'} onChange={e => setAddFormData({...addFormData, vaultType: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary">
                        <option value="password">Password</option>
                        <option value="course">Kursus</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-text-muted mb-1 block">Platform / Judul *</label>
                      <input type="text" required value={addFormData.title || ''} onChange={e => setAddFormData({...addFormData, title: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted mb-1 block">Username / Email</label>
                    <input type="text" value={addFormData.username || ''} onChange={e => setAddFormData({...addFormData, username: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted mb-1 block">Password</label>
                    <input type="text" value={addFormData.password || ''} onChange={e => setAddFormData({...addFormData, password: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary" />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setAddModalOpen(false)} className="px-4 py-2 rounded-lg text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm font-bold">Batal</button>
                <button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-transform active:scale-95 text-sm font-bold shadow-md">
                  {saving ? 'Menyimpan...' : 'Tambah Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};