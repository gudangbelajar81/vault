import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Plus, X, CreditCard, Calendar, TrendingUp, AlertCircle, Edit2, Trash2, CheckCircle, PauseCircle } from 'lucide-react';

interface Subscription {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: string;
  nextBillingDate: string;
  status: string;
  accountEmail?: string;
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

const emptyForm = { name: '', price: '' as number | '', currency: 'IDR', billingCycle: 'monthly', nextBillingDate: '', status: 'active', accountEmail: '' };

export const Subscriptions = () => {
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<typeof emptyForm>(emptyForm);

  const fetchItems = async () => {
    try {
      const res = await axios.get(API, { withCredentials: true });
      setItems(res.data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const openAdd = () => { setEditId(null); setFormData(emptyForm); setIsModalOpen(true); };
  const openEdit = (sub: Subscription) => {
    setEditId(sub.id);
    setFormData({
      name: sub.name,
      price: sub.price,
      currency: sub.currency,
      billingCycle: sub.billingCycle,
      nextBillingDate: sub.nextBillingDate.split('T')[0],
      status: sub.status,
      accountEmail: sub.accountEmail || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await axios.put(`${API}/${editId}`, formData, { withCredentials: true });
      } else {
        await axios.post(API, formData, { withCredentials: true });
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (error) {
      alert('Gagal menyimpan data');
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Subscription Tracker</h2>
          <p className="text-text-muted text-sm mt-1">Pantau semua langganan & tagihan Anda.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-transform active:scale-95 shadow-[0_0_15px_rgba(var(--color-primary),0.3)]"
        >
          <Plus size={18} /> New Subscription
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface/50 border border-border rounded-xl p-5 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
              <CreditCard size={20} />
            </div>
            <span className="text-sm text-text-muted font-medium">Total Aktif</span>
          </div>
          <p className="text-3xl font-black text-text-primary">{activeItems.length}</p>
          <p className="text-xs text-text-muted mt-1">langganan berjalan</p>
        </div>

        <div className="bg-surface/50 border border-border rounded-xl p-5 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center text-success">
              <TrendingUp size={20} />
            </div>
            <span className="text-sm text-text-muted font-medium">Pengeluaran/Bulan</span>
          </div>
          <p className="text-2xl font-black text-text-primary">{formatCurrency(totalMonthly, 'IDR')}</p>
          <p className="text-xs text-text-muted mt-1">estimasi bulanan</p>
        </div>

        <div className={`bg-surface/50 border rounded-xl p-5 backdrop-blur-sm ${dueThisWeek > 0 ? 'border-warning/50 bg-warning/5' : 'border-border'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dueThisWeek > 0 ? 'bg-warning/15 text-warning' : 'bg-info/15 text-info'}`}>
              <AlertCircle size={20} />
            </div>
            <span className="text-sm text-text-muted font-medium">Jatuh Tempo</span>
          </div>
          <p className="text-3xl font-black text-text-primary">{dueThisWeek}</p>
          <p className="text-xs text-text-muted mt-1">dalam 7 hari ke depan</p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col text-text-muted py-20">
            <CreditCard size={48} className="mb-4 opacity-30" />
            <p className="font-semibold">Belum ada langganan.</p>
            <p className="text-sm mt-1">Tambahkan langganan pertama Anda.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Layanan</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Harga</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Tagihan Berikutnya</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const days = getDaysUntil(item.nextBillingDate);
                return (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center font-black text-white text-sm">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-text-primary">{item.name}</p>
                          <p className="text-xs text-text-muted capitalize">{item.billingCycle === 'monthly' ? 'Bulanan' : 'Tahunan'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-text-primary">{formatCurrency(item.price, item.currency)}</p>
                      <p className="text-xs text-text-muted">/{item.billingCycle === 'monthly' ? 'bln' : 'thn'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-text-primary">{new Date(item.nextBillingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <div className="mt-0.5">{getDueBadge(days, item.status)}</div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 size={15} />
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-white">{editId ? 'Edit Langganan' : 'Tambah Langganan'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-white transition-colors"><X size={22} /></button>
            </div>

            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Nama Layanan *</label>
                <input
                  type="text" required value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Netflix, Spotify, ChatGPT Plus..."
                  className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-text-muted mb-1 block">Harga</label>
                  <input
                    type="number" value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    placeholder="0"
                    className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-muted mb-1 block">Mata Uang</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  >
                    <option value="IDR">IDR (Rupiah)</option>
                    <option value="USD">USD (Dollar)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-text-muted mb-1 block">Siklus Tagihan</label>
                  <select
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  >
                    <option value="monthly">Bulanan</option>
                    <option value="yearly">Tahunan</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-text-muted mb-1 block">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  >
                    <option value="active">Aktif</option>
                    <option value="paused">Dijeda</option>
                    <option value="cancelled">Dibatalkan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Tagihan Berikutnya</label>
                <input
                  type="date" value={formData.nextBillingDate}
                  onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
                  className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Email Akun (Untuk Pemetaan / Jalan Pintas)</label>
                <input
                  type="email" value={formData.accountEmail}
                  onChange={(e) => setFormData({ ...formData, accountEmail: e.target.value })}
                  placeholder="bos@gmail.com"
                  className="w-full bg-black/40 border border-border rounded-lg px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors font-medium">
                  Batal
                </button>
                <button type="submit" disabled={saving || !formData.name}
                  className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium shadow-md">
                  {saving ? 'Menyimpan...' : (editId ? 'Perbarui' : 'Simpan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
