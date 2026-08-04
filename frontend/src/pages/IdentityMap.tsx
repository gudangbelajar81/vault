import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useVaultStore } from '../store/vaultStore';
import { decryptData, encryptData } from '../utils/crypto';
import { Network, Mail, Key, CreditCard, GraduationCap, X, Edit2, Trash2, Globe, Shield } from 'lucide-react';
import { API_URL } from '../config';

interface MappedNode {
  id: string;
  type: string; // 'password', 'course', 'api_key', 'subscription', 'shortcut'
  title: string;
  email: string;
  raw: any; // The original decrypted data or subscription object
}

export const IdentityMap = () => {
  const { masterPassword } = useVaultStore();
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<MappedNode[]>([]);
  
  // Edit State
  const [editItem, setEditItem] = useState<MappedNode | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

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

      // Process Vault Items
      for (const item of vaultItems) {
        try {
          const decryptedStr = await decryptData(item.encryptedData, masterPassword);
          const data = JSON.parse(decryptedStr);
          
          let email = '';
          if (item.type === 'password' || item.type === 'course') {
            email = data.username?.toLowerCase().trim() || '';
          }
          // Note: API keys and shortcuts typically don't have usernames, but if they do, we'd map them.
          
          if (email) {
            mapped.push({
              id: item.id,
              type: item.type,
              title: item.title,
              email: email,
              raw: { ...item, decryptedData: data }
            });
          } else if (item.type === 'password' && item.title.includes('@')) {
            // Fallback: If title looks like an email and no username is set
            mapped.push({
              id: item.id,
              type: item.type,
              title: item.title,
              email: item.title.toLowerCase().trim(),
              raw: { ...item, decryptedData: data }
            });
          }
        } catch (e) {
          console.error('Failed to decrypt item for map', e);
        }
      }

      // Process Subscriptions
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !masterPassword) return;
    setSaving(true);
    
    try {
      if (editItem.type === 'subscription') {
        await axios.put(`${API_URL}/api/subscriptions/${editItem.id}`, editFormData, { withCredentials: true });
      } else {
        // Vault Item
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
      console.error(error);
      alert('Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  // Group by email
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
    <div className="h-full flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-md bg-primary/20 text-primary flex items-center justify-center shrink-0">
             <Network size={14} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary leading-tight">Peta Identitas</h2>
            <p className="text-[10px] text-text-muted leading-tight">Kelola keterhubungan akun</p>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-y-auto p-6 backdrop-blur-sm">
        {loading ? (
          <div className="text-center text-text-muted py-10">Memuat peta...</div>
        ) : Object.keys(groups).length === 0 ? (
          <div className="text-center text-text-muted py-10">
            <Network size={48} className="mx-auto mb-4 opacity-50" />
            <p>Belum ada data yang terhubung.</p>
            <p className="text-xs mt-2 max-w-md mx-auto">Pastikan Anda mengisi kolom Username/Email saat menambah Password/Kursus, dan kolom Email Akun saat menambah Langganan.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.entries(groups).map(([email, children]) => (
              <div key={email} className="relative">
                {/* Root Node (Email) */}
                <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 w-fit shadow-lg relative z-10">
                  <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                    <Mail size={16} />
                  </div>
                  <span className="font-bold text-text-primary tracking-wide">{email}</span>
                  <span className="bg-border text-text-muted text-xs px-2 py-0.5 rounded-full ml-2">{children.length} terhubung</span>
                </div>

                {/* Branches */}
                <div className="ml-8 mt-2 flex flex-col gap-3 border-l-2 border-border/50 pl-6 py-2 relative">
                  {children.map((child, idx) => (
                    <div key={child.id} className="relative group flex items-center justify-between bg-black/5 dark:bg-black/40 border border-border/50 rounded-lg px-4 py-2.5 w-full max-w-2xl hover:border-primary/50 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                      {/* Horizontal connecting line */}
                      <div className="absolute -left-6 top-1/2 w-6 border-t-2 border-border/50 -translate-y-1/2"></div>
                      
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-md bg-black/5 dark:bg-white/5 flex items-center justify-center">
                          {getIcon(child.type)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{child.title}</p>
                          <p className="text-[10px] text-text-muted uppercase tracking-wider">{child.type}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(child)} className="p-1.5 text-text-muted hover:text-text-primary bg-surface rounded-md border border-border"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(child)} className="p-1.5 text-danger hover:bg-danger/10 bg-surface rounded-md border border-border"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unified Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if(e.target === e.currentTarget) setEditItem(null) }}>
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-text-primary">Edit {editItem.title}</h3>
              <button onClick={() => setEditItem(null)} className="text-text-muted hover:text-text-primary transition-colors"><X size={22} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              {/* Render fields dynamically based on type */}
              
              {editItem.type === 'subscription' && (
                <>
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">Nama Layanan</label>
                    <input type="text" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary" />
                  </div>
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">Harga</label>
                    <input type="number" value={editFormData.price || ''} onChange={e => setEditFormData({...editFormData, price: e.target.value ? parseFloat(e.target.value) : ''})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary" />
                  </div>
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">Email Akun</label>
                    <input type="email" value={editFormData.accountEmail || ''} onChange={e => setEditFormData({...editFormData, accountEmail: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary" />
                  </div>
                </>
              )}

              {(editItem.type === 'password' || editItem.type === 'course') && (
                <>
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">Judul / Platform</label>
                    <input type="text" value={editFormData.title || ''} onChange={e => setEditFormData({...editFormData, title: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary" />
                  </div>
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">Username / Email</label>
                    <input type="text" value={editFormData.username || ''} onChange={e => setEditFormData({...editFormData, username: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary" />
                  </div>
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">Password</label>
                    <input type="text" value={editFormData.password || ''} onChange={e => setEditFormData({...editFormData, password: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary" />
                  </div>
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">URL (Opsional)</label>
                    <input type="text" value={editFormData.url || ''} onChange={e => setEditFormData({...editFormData, url: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary" />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setEditItem(null)} className="px-5 py-2.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium">Batal</button>
                <button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg transition-transform active:scale-95 font-medium shadow-md">
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