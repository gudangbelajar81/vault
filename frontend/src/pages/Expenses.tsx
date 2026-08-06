import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Wallet, Plus, Edit2, Trash2, X, TrendingDown, DollarSign, Calendar, Tag, FileText } from 'lucide-react';
import { API_URL } from '../config';

interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  notes: string | null;
}

export const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Expense | null>(null);
  const [formData, setFormData] = useState<Partial<Omit<Expense, 'amount'>> & { amount?: number | '' }>({});
  const [saving, setSaving] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/expenses`, { withCredentials: true });
      if (res.data.success) {
        setExpenses(res.data.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const openAdd = () => {
    setEditItem(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      currency: 'IDR'
    });
    setModalOpen(true);
  };

  const openEdit = (item: Expense) => {
    setEditItem(item);
    setFormData({
      ...item,
      date: new Date(item.date).toISOString().split('T')[0]
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Hapus pengeluaran "${title}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/expenses/${id}`, { withCredentials: true });
      fetchExpenses();
    } catch (error) {
      alert('Gagal menghapus pengeluaran');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await axios.put(`${API_URL}/api/expenses/${editItem.id}`, formData, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/api/expenses`, formData, { withCredentials: true });
      }
      setModalOpen(false);
      fetchExpenses();
    } catch (error) {
      alert('Gagal menyimpan pengeluaran');
    } finally {
      setSaving(false);
    }
  };

  // Calculate current month total
  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return expenses
      .filter(exp => {
        const expDate = new Date(exp.date);
        return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency }).format(amount);
  };

  return (
    <div className="h-full flex flex-col relative max-w-5xl mx-auto w-full">
      <div className="mb-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-danger/20 text-danger flex items-center justify-center shrink-0">
             <Wallet size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary leading-tight">Pengeluaran</h2>
            <p className="text-xs text-text-muted leading-tight">Pantau arus kas Anda</p>
          </div>
        </div>
        <button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95">
          <Plus size={16} /> Tambah
        </button>
      </div>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
         <div className="bg-surface border border-border rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-danger/50 transition-colors">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-danger/10 rounded-full blur-2xl group-hover:bg-danger/20 transition-all"></div>
            <div className="flex items-center gap-2 text-danger mb-2 relative z-10">
               <TrendingDown size={16} />
               <span className="text-xs font-bold uppercase tracking-wider">Total Bulan Ini</span>
            </div>
            <h3 className="text-3xl font-black text-text-primary relative z-10 tracking-tight">
               {formatCurrency(currentMonthTotal, 'IDR')}
            </h3>
         </div>
         {/* Could add more dashboard cards here like Category Breakdown in the future */}
      </div>

      {/* Expenses List */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-surface/30 border border-border rounded-2xl p-4 md:p-6 backdrop-blur-sm shadow-inner">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">Memuat data...</div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Wallet size={48} className="mb-4 opacity-30" />
            <p>Belum ada catatan pengeluaran.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
             {expenses.map((expense) => (
                <div key={expense.id} className="bg-surface border border-border hover:border-border/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm group">
                   
                   <div className="flex items-start sm:items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0">
                         <DollarSign size={20} />
                      </div>
                      <div className="flex flex-col">
                         <h4 className="font-bold text-text-primary text-sm">{expense.title}</h4>
                         <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-text-muted">
                            <span className="flex items-center gap-1 bg-black/10 dark:bg-white/5 px-2 py-0.5 rounded-full"><Calendar size={10}/> {new Date(expense.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span className="flex items-center gap-1 bg-black/10 dark:bg-white/5 px-2 py-0.5 rounded-full"><Tag size={10}/> {expense.category}</span>
                         </div>
                         {expense.notes && <p className="text-xs text-text-muted mt-2 flex items-start gap-1 opacity-80"><FileText size={12} className="mt-0.5 shrink-0"/> {expense.notes}</p>}
                      </div>
                   </div>

                   <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full border-t border-border sm:border-0 pt-3 sm:pt-0">
                      <div className="text-right">
                         <span className="font-black text-danger text-lg">{formatCurrency(expense.amount, expense.currency)}</span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => openEdit(expense)} className="p-2 bg-black/5 dark:bg-white/5 rounded-lg hover:text-primary transition-colors text-text-muted" title="Edit">
                            <Edit2 size={14}/>
                         </button>
                         <button onClick={() => handleDelete(expense.id, expense.title)} className="p-2 bg-black/5 dark:bg-white/5 rounded-lg hover:bg-danger/20 hover:text-danger transition-colors text-text-muted" title="Hapus">
                            <Trash2 size={14}/>
                         </button>
                      </div>
                   </div>

                </div>
             ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if(e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-border bg-black/5">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                 {editItem ? <Edit2 size={18} className="text-primary"/> : <Plus size={18} className="text-primary"/>} 
                 {editItem ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-semibold text-text-muted mb-1 block">Nama / Judul *</label>
                   <input type="text" required value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Contoh: Makan Siang" className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary transition-colors" />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-text-muted mb-1 block">Kategori *</label>
                   <input type="text" required value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Contoh: Makanan, Transport" className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary transition-colors" />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-semibold text-text-muted mb-1 block">Jumlah / Nominal *</label>
                   <input type="number" required min="0" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: e.target.value === '' ? '' : parseFloat(e.target.value)})} placeholder="Contoh: 50000" className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary transition-colors" />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-text-muted mb-1 block">Mata Uang</label>
                      <select value={formData.currency || 'IDR'} onChange={e => setFormData({...formData, currency: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary transition-colors">
                        <option value="IDR">IDR</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-text-muted mb-1 block">Tanggal *</label>
                      <input type="date" required value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary transition-colors" />
                    </div>
                 </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-muted mb-1 block">Catatan Tambahan (Opsional)</label>
                <textarea rows={2} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Tulis catatan jika diperlukan..." className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary transition-colors custom-scrollbar" />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 rounded-lg text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm font-bold">Batal</button>
                <button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-transform active:scale-95 text-sm font-bold shadow-lg shadow-primary/20">
                  {saving ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
