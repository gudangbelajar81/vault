import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Plus, X, CreditCard, Calendar, TrendingUp, AlertCircle, Edit2, Trash2, CheckCircle, PauseCircle, ExternalLink, Copy, Eye, EyeOff, Lock } from 'lucide-react';
import { useVaultStore } from '../store/vaultStore';
import { encryptData, decryptData } from '../utils/crypto';
import toast from 'react-hot-toast';

interface Subscription {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: string;
  nextBillingDate: string;
  status: string;
  accountEmail?: string;
  encryptedNotes?: string;
  decryptedNotes?: any;
}

const API = `${API_URL}/api/subscriptions`;

const CURRENCY_FORMAT: Record<string, string> = {
  IDR: 'id-ID',
  USD: 'en-US',
};

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat(CURRENCY_FORMAT[currency] || 'id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getDaysUntil = (dateStr: string) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success text-xs font-semibold"><CheckCircle size={10} /> Aktif</span>;
    case 'paused':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-xs font-semibold"><PauseCircle size={10} /> Dijeda</span>;
    case 'cancelled':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/15 text-danger text-xs font-semibold"><X size={10} /> Dibatalkan</span>;
    default:
      return null;
  }
};

const getDueBadge = (days: number, status: string) => {
  if (status !== 'active') return null;
  if (days < 0) return <span className="text-xs text-danger font-bold">Terlambat!</span>;
  if (days === 0) return <span className="text-xs text-danger font-bold animate-pulse">Hari ini!</span>;
  if (days <= 3) return <span className="text-xs text-warning font-semibold">{days} hari lagi ⚠️</span>;
  if (days <= 7) return <span className="text-xs text-info">{days} hari lagi</span>;
  return <span className="text-xs text-text-muted">{days} hari lagi</span>;
};

const getEmptyForm = () => ({ id: Date.now().toString() + Math.random(), name: '', price: '' as number | '', currency: 'IDR', billingCycle: 'monthly', nextBillingDate: '', status: 'active', accountEmail: '', url: '', password: '' });

export const Subscriptions = () => {
  const { masterPassword } = useVaultStore();
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formsData, setFormsData] = useState<ReturnType<typeof getEmptyForm>[]>([]);

  const fetchItems = async () => {
    try {
      const res = await axios.get(API, { withCredentials: true });
      const itemsList = res.data.data || [];
      
      // Decrypt notes if available
      if (masterPassword) {
        for (const item of itemsList) {
          if (item.encryptedNotes) {
            try {
              const decrypted = await decryptData(item.encryptedNotes, masterPassword);
              item.decryptedNotes = JSON.parse(decrypted);
            } catch(e) {}
          }
        }
      }
      setItems(itemsList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => { fetchItems(); }, []);

  const openAdd = () => { setEditId(null); setFormsData([getEmptyForm()]); setIsModalOpen(true); };

    const openEdit = (sub: Subscription) => {
      setEditId(sub.id);
      setFormsData([{
        id: sub.id,
        name: sub.name,
        price: sub.price,
        currency: sub.currency,
        billingCycle: sub.billingCycle,
        nextBillingDate: sub.nextBillingDate.split('T')[0],
        status: sub.status,
        accountEmail: sub.accountEmail || '',
        url: sub.decryptedNotes?.url || '',
        password: sub.decryptedNotes?.password || '',
      }]);
      setIsModalOpen(true);
    };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const processedForms = await Promise.all(formsData.map(async (data: any) => {
        let encryptedNotes = '';
        if (data.url || data.password) {
          if (!masterPassword) {
            throw new Error('Master password diperlukan untuk enkripsi');
          }
          const notesObj = { url: data.url, password: data.password };
          encryptedNotes = await encryptData(JSON.stringify(notesObj), masterPassword);
        }
        
        return {
          ...data,
          encryptedNotes: encryptedNotes || undefined
        };
      }));

      if (editId) {
        await axios.put(`${API}/${editId}`, processedForms[0], { withCredentials: true });
      } else {
        await Promise.all(
          processedForms.map(data => axios.post(API, data, { withCredentials: true }))
        );
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (error: any) {
      alert(error.message || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };



  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Hapus langganan "${name}"?`)) return;
    try {
      await axios.delete(`${API}/${id}`, { withCredentials: true });
      fetchItems();
    } catch (error) {
      alert('Gagal menghapus');
    }
  };

  // Stats
  const activeItems = items.filter(i => i.status === 'active');
  const totalMonthly = activeItems.reduce((sum, i) => {
    const price = i.currency === 'USD' ? i.price * 16000 : i.price;
    return sum + (i.billingCycle === 'yearly' ? price / 12 : price);
  }, 0);
  const dueThisWeek = activeItems.filter(i => { const d = getDaysUntil(i.nextBillingDate); return d >= 0 && d <= 7; }).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-bold text-text-primary">Subscriptions</h2>
        <button
          onClick={openAdd}
          className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-transform active:scale-95 shadow-[0_0_10px_rgba(var(--color-primary),0.3)] text-xs"
        >
          <Plus size={14} /> <span className="hidden sm:inline">New Subscription</span><span className="sm:hidden">Baru</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-surface/50 border border-border rounded-lg p-2 md:p-3 backdrop-blur-sm flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-primary/15 flex items-center justify-center text-primary">
              <CreditCard size={12} />
            </div>
            <span className="text-[10px] md:text-xs text-text-muted font-medium truncate">Aktif</span>
          </div>
          <p className="text-sm md:text-base font-black text-text-primary">{activeItems.length}</p>
        </div>

        <div className="bg-surface/50 border border-border rounded-lg p-2 md:p-3 backdrop-blur-sm flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-success/15 flex items-center justify-center text-success">
              <TrendingUp size={12} />
            </div>
            <span className="text-[10px] md:text-xs text-text-muted font-medium truncate">Pengeluaran</span>
          </div>
          <p className="text-sm md:text-base font-black text-text-primary truncate">{formatCurrency(totalMonthly, 'IDR')}</p>
        </div>

        <div className={`bg-surface/50 border rounded-lg p-2 md:p-3 backdrop-blur-sm flex flex-col justify-center ${dueThisWeek > 0 ? 'border-warning/50 bg-warning/5' : 'border-border'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <div className={`w-5 h-5 md:w-6 md:h-6 rounded flex items-center justify-center ${dueThisWeek > 0 ? 'bg-warning/15 text-warning' : 'bg-info/15 text-info'}`}>
              <AlertCircle size={12} />
            </div>
            <span className="text-[10px] md:text-xs text-text-muted font-medium truncate">Tempo (7h)</span>
          </div>
          <p className="text-sm md:text-base font-black text-text-primary">{dueThisWeek}</p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-y-auto backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-text-muted py-10 opacity-50">
            <CreditCard size={32} className="mb-2" />
            <p className="text-xs font-semibold">Belum ada langganan.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Layanan</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Harga</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Tagihan Berikutnya</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-text-muted uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const days = getDaysUntil(item.nextBillingDate);
                return (
                  <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center font-black text-white text-[10px]">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-text-primary text-xs">{item.name}</p>
                          <p className="text-[10px] text-text-muted capitalize">{item.billingCycle === 'monthly' ? 'Bln' : 'Thn'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-bold text-text-primary text-xs">{formatCurrency(item.price, item.currency)}</p>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <p className="text-xs text-text-primary">{new Date(item.nextBillingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                      <div className="mt-0.5">{getDueBadge(days, item.status)}</div>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">{getStatusBadge(item.status)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
          <div className="bg-surface border border-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-3 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary">{editId ? 'Edit Langganan' : 'Tambah Langganan'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors"><X size={16} /></button>
            </div>

            <form onSubmit={handleSave} className="p-3 flex flex-col gap-2 max-h-[75vh] overflow-y-auto">
              {formsData.map((formData, index) => (
                <div key={formData.id} className={`flex flex-col gap-2 ${index > 0 ? 'mt-4 pt-4 border-t border-border/50' : ''}`}>
                  {formsData.length > 1 && (
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Langganan {index + 1}</span>
                      <button 
                        type="button" 
                        onClick={() => setFormsData(formsData.filter((_, i) => i !== index))}
                        className="text-danger hover:bg-danger/10 p-1 rounded transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                  {/* Baris 1 (4 form) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Nama Layanan *</label>
                      <input
                        type="text" required value={formData.name}
                        onChange={(e) => {
                          const newForms = [...formsData];
                          newForms[index].name = e.target.value;
                          setFormsData(newForms);
                        }}
                        placeholder="Netflix..."
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Harga</label>
                      <input
                        type="text" value={formData.price === '' || formData.price === undefined ? '' : formatCurrency(formData.price as number, formData.currency || 'IDR')}
                        onChange={(e) => {
                          const newForms = [...formsData];
                          const rawValue = e.target.value.replace(/[^0-9]/g, '');
                          newForms[index].price = rawValue === '' ? '' : parseFloat(rawValue);
                          setFormsData(newForms);
                        }}
                        placeholder="0"
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Email Akun</label>
                      <input
                        type="email" value={formData.accountEmail || ''}
                        onChange={(e) => {
                          const newForms = [...formsData];
                          newForms[index].accountEmail = e.target.value;
                          setFormsData(newForms);
                        }}
                        placeholder="@"
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 flex items-center gap-1"><Lock size={10}/> Password</label>
                      <div className="relative">
                        <input
                          type={showPasswordMap['form_'+index] ? "text" : "password"} 
                          value={formData.password || ''}
                          onChange={(e) => {
                            const newForms = [...formsData];
                            newForms[index].password = e.target.value;
                            setFormsData(newForms);
                          }}
                          placeholder="***"
                          className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg pl-2 pr-7 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                        <button type="button" onClick={() => setShowPasswordMap({...showPasswordMap, ['form_'+index]: !showPasswordMap['form_'+index]})} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                          {showPasswordMap['form_'+index] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* URL Akses */}
                  <div className="mt-2 mb-2">
                    <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Link Akses URL</label>
                    <input
                      type="url" value={formData.url || ''}
                      onChange={(e) => {
                        const newForms = [...formsData];
                        newForms[index].url = e.target.value;
                        setFormsData(newForms);
                      }}
                      placeholder="https://netflix.com/login"
                      className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>


                  {/* Baris 2 (4 form) */}
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Siklus</label>
                      <select
                        value={formData.billingCycle}
                        onChange={(e) => {
                          const newForms = [...formsData];
                          newForms[index].billingCycle = e.target.value;
                          setFormsData(newForms);
                        }}
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-1 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      >
                        <option value="monthly">Bulan</option>
                        <option value="yearly">Tahun</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => {
                          const newForms = [...formsData];
                          newForms[index].status = e.target.value;
                          setFormsData(newForms);
                        }}
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-1 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      >
                        <option value="active">Aktif</option>
                        <option value="paused">Jeda</option>
                        <option value="cancelled">Batal</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Tagihan</label>
                      <input
                        type="date" value={formData.nextBillingDate}
                        onChange={(e) => {
                          const newForms = [...formsData];
                          newForms[index].nextBillingDate = e.target.value;
                          setFormsData(newForms);
                        }}
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-1 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Mata Uang</label>
                      <select
                        value={formData.currency}
                        onChange={(e) => {
                          const newForms = [...formsData];
                          newForms[index].currency = e.target.value;
                          setFormsData(newForms);
                        }}
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-1 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      >
                        <option value="IDR">IDR</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {!editId && (
                <button 
                  type="button"
                  onClick={() => setFormsData([...formsData, getEmptyForm()])}
                  className="mt-2 w-full border border-dashed border-border hover:border-primary/50 text-text-muted hover:text-primary bg-transparent hover:bg-primary/5 py-1.5 rounded-xl transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <Plus size={12} />
                  Tambah Langganan Lain
                </button>
              )}

              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/50 sticky bottom-0 bg-surface">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium text-xs">
                  Batal
                </button>
                <button type="submit" disabled={saving || formsData.some(f => !f.name)}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium shadow-md text-xs">
                  {saving ? 'Menyimpan...' : (editId ? 'Perbarui' : 'Simpan Semua')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
