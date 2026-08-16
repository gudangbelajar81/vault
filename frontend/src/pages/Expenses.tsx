import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Wallet, Plus, Edit2, Trash2, X, TrendingDown, DollarSign, Calendar, Tag, FileText, Download, Upload } from 'lucide-react';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

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
  const [amounts, setAmounts] = useState<string[]>(['']);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const uniqueCategories = useMemo(() => Array.from(new Set(expenses.map(e => e.category).filter(Boolean))), [expenses]);

  const handleExportCSV = () => {
    if (expenses.length === 0) return toast.error('Belum ada data untuk diekspor');
    
    const headers = ['Tanggal', 'Judul', 'Kategori', 'Jumlah', 'Mata Uang', 'Catatan'];
    const rows = expenses.map(exp => [
      new Date(exp.date).toISOString().split('T')[0],
      `"${(exp.title || '').replace(/"/g, '""')}"`,
      `"${(exp.category || '').replace(/"/g, '""')}"`,
      exp.amount,
      exp.currency,
      `"${(exp.notes || '').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.map(e => e.join(',')).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pengeluaran_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Berhasil mengekspor data ke CSV');
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length <= 1) return toast.error('File CSV kosong atau tidak valid');
        
        let successCount = 0;
        let failCount = 0;
        toast.loading('Memproses impor CSV...', { id: 'importCsv' });
        
        for (let i = 1; i < lines.length; i++) {
          let row = lines[i];
          const arr = [];
          let quote = false;
          let cell = '';
          for (let c = 0; c < row.length; c++) {
              let char = row[c];
              if (char === '"' && row[c+1] === '"') { cell += '"'; c++; }
              else if (char === '"') quote = !quote;
              else if (char === ',' && !quote) { arr.push(cell); cell = ''; }
              else cell += char;
          }
          arr.push(cell);
          
          if (arr.length >= 4) {
             const [date, title, category, amountStr, currency, notes] = arr;
             const amount = parseFloat(amountStr);
             
             if (title && category && !isNaN(amount)) {
                try {
                  await axios.post(`${API_URL}/api/expenses`, {
                    date: date || new Date().toISOString().split('T')[0],
                    title: title.trim(),
                    category: category.trim(),
                    amount,
                    currency: currency || 'IDR',
                    notes: notes ? notes.trim() : ''
                  }, { withCredentials: true });
                  successCount++;
                } catch(e) { failCount++; }
             } else { failCount++; }
          }
        }
        
        toast.dismiss('importCsv');
        toast.success(`Berhasil impor ${successCount} data${failCount > 0 ? `, ${failCount} gagal` : ''}`);
        fetchExpenses();
      } catch (err) {
        toast.dismiss('importCsv');
        toast.error('Gagal memproses file CSV');
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

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
    setAmounts(['']);
    setModalOpen(true);
  };

  const openEdit = (item: Expense) => {
    setEditItem(item);
    setFormData({
      ...item,
      date: new Date(item.date).toISOString().split('T')[0]
    });
    setAmounts([item.amount.toString()]);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Hapus pengeluaran "${title}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/expenses/${id}`, { withCredentials: true });
      fetchExpenses();
    } catch (error) {
      toast.error('Gagal menghapus pengeluaran');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const totalAmount = amounts.reduce((sum, val) => sum + (parseFloat(val.replace(/[^0-9]/g, '')) || 0), 0);
    try {
      const payload = {
        ...formData,
        amount: totalAmount,
        currency: 'IDR'
      };
      if (editItem) {
        await axios.put(`${API_URL}/api/expenses/${editItem.id}`, payload, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/api/expenses`, payload, { withCredentials: true });
      }
      setModalOpen(false);
      fetchExpenses();
      toast.success('Pengeluaran berhasil disimpan');
    } catch (error) {
      toast.error('Gagal menyimpan pengeluaran');
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
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="h-full flex flex-col relative max-w-5xl mx-auto w-full">
      <div className="mb-3 md:mb-6 flex items-center justify-between z-10 sticky top-0 bg-bg-primary/90 backdrop-blur-md pb-2 pt-1 border-b border-border sm:border-0 sm:pb-0 sm:pt-0 sm:relative sm:bg-transparent sm:backdrop-blur-none">
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="h-6 w-6 md:h-8 md:w-8 rounded-lg bg-danger/20 text-danger flex items-center justify-center shrink-0">
             <Wallet className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
          </div>
          <div>
            <h2 className="text-sm md:text-lg font-bold text-text-primary leading-tight">Pengeluaran</h2>
            <p className="text-[10px] md:text-xs text-text-muted leading-tight">Pantau arus kas</p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="bg-surface border border-border hover:bg-black/5 dark:hover:bg-white/5 text-text-primary px-3 py-2 rounded-lg text-[11px] md:text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hidden sm:flex">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={handleExportCSV} className="bg-surface border border-border hover:bg-black/5 dark:hover:bg-white/5 text-text-primary px-3 py-2 rounded-lg text-[11px] md:text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hidden sm:flex">
            <Download size={14} /> Export CSV
          </button>
          
          {/* Mobile Import/Export Icons */}
          <button onClick={() => fileInputRef.current?.click()} className="sm:hidden bg-surface border border-border hover:bg-black/5 dark:hover:bg-white/5 text-text-primary p-1.5 md:p-2 rounded-lg transition-all shadow-sm">
            <Upload size={14} />
          </button>
          <button onClick={handleExportCSV} className="sm:hidden bg-surface border border-border hover:bg-black/5 dark:hover:bg-white/5 text-text-primary p-1.5 md:p-2 rounded-lg transition-all shadow-sm">
            <Download size={14} />
          </button>

          <button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white px-2 py-1.5 md:px-4 md:py-2 rounded-lg text-[11px] md:text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-1 md:gap-2 transition-all active:scale-95 ml-0.5 md:ml-2">
            <Plus size={14} className="md:w-4 md:h-4" /> <span className="hidden sm:inline">Tambah</span><span className="sm:hidden">Baru</span>
          </button>
        </div>
      </div>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-8">
         <div className="bg-surface border border-border rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg relative overflow-hidden group hover:border-danger/50 transition-colors">
            <div className="absolute -right-4 -top-4 w-16 h-16 md:w-24 md:h-24 bg-danger/10 rounded-full blur-2xl group-hover:bg-danger/20 transition-all"></div>
            <div className="flex items-center gap-1.5 md:gap-2 text-danger mb-1 md:mb-2 relative z-10">
               <TrendingDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
               <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Total Bulan Ini</span>
            </div>
            <h3 className="text-xl md:text-3xl font-black text-text-primary relative z-10 tracking-tight">
               {formatCurrency(currentMonthTotal, 'IDR')}
            </h3>
         </div>
      </div>

      {/* Expenses List */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-surface/30 border border-border rounded-xl md:rounded-2xl p-2 md:p-6 backdrop-blur-sm shadow-inner">
        {loading ? (
          <div className="flex items-center justify-center h-full text-[11px] md:text-sm text-text-muted">Memuat data...</div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-[11px] md:text-sm">
            <Wallet size={32} className="mb-2 md:mb-4 opacity-30 md:w-12 md:h-12" />
            <p>Belum ada catatan pengeluaran.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 md:gap-3">
             {expenses.map((expense) => (
                <div key={expense.id} className="bg-surface border border-border hover:border-border/80 rounded-lg md:rounded-xl p-2 md:p-4 flex items-center justify-between gap-1.5 md:gap-4 transition-all shadow-sm group">
                   
                   <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                      <div className="h-7 w-7 md:h-10 md:w-10 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0">
                         <DollarSign className="w-3.5 h-3.5 md:w-5 md:h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                         <div className="flex items-center gap-1 md:gap-2">
                           <h4 className="font-bold text-text-primary text-[12px] md:text-sm truncate">{expense.title}</h4>
                           <span className="hidden sm:flex items-center gap-1 bg-black/10 dark:bg-white/5 px-2 py-0.5 rounded-full text-[10px] md:text-xs whitespace-nowrap"><Tag size={10}/> {expense.category}</span>
                         </div>
                         <div className="flex items-center gap-1 md:gap-2 mt-0.5 text-[10px] md:text-xs text-text-muted">
                            <span className="flex items-center gap-0.5"><Calendar size={10}/> {new Date(expense.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                            <span className="sm:hidden flex items-center gap-0.5"><Tag size={10}/> {expense.category}</span>
                         </div>
                         {expense.notes && <p className="hidden md:flex text-xs text-text-muted mt-1.5 items-start gap-1 opacity-80"><FileText size={12} className="mt-0.5 shrink-0"/> {expense.notes}</p>}
                      </div>
                   </div>

                   <div className="flex items-center gap-2 md:gap-6 shrink-0">
                      <div className="text-right">
                         <span className="font-black text-danger text-[13px] md:text-lg leading-none">{formatCurrency(expense.amount, expense.currency)}</span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-0.5 md:gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => openEdit(expense)} className="p-1.5 md:p-2 bg-black/5 dark:bg-white/5 rounded-lg hover:text-primary transition-colors text-text-muted" title="Edit">
                            <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4"/>
                         </button>
                         <button onClick={() => handleDelete(expense.id, expense.title)} className="p-1.5 md:p-2 bg-black/5 dark:bg-white/5 rounded-lg hover:bg-danger/20 hover:text-danger transition-colors text-text-muted" title="Hapus">
                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4"/>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if(e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="bg-surface border border-border w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-slide-up sm:animate-none">
            <div className="flex justify-between items-center p-3.5 sm:p-5 border-b border-border bg-black/5 shrink-0">
              <h3 className="text-sm sm:text-lg font-bold text-text-primary flex items-center gap-2">
                 {editItem ? <Edit2 size={16} className="text-primary"/> : <Plus size={16} className="text-primary"/>} 
                 {editItem ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-text-muted hover:text-text-primary p-1 transition-colors"><X size={18} /></button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar">
              <form onSubmit={handleSave} className="p-3.5 sm:p-5 flex flex-col gap-2.5 sm:gap-4">
                
                <div className="relative">
                  <input 
                    list="category-options" 
                    type="text" 
                    required 
                    value={formData.category || ''} 
                    onChange={e => setFormData({...formData, category: e.target.value})} 
                    placeholder="Kategori (Ketik atau Pilih) *" 
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-[12px] sm:text-sm text-text-primary outline-none focus:border-primary transition-colors" 
                  />
                  <datalist id="category-options">
                    {uniqueCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <input 
                    type="text" 
                    required 
                    value={formData.title || ''} 
                    onChange={e => setFormData({...formData, title: e.target.value})} 
                    placeholder="Nama / Judul Pengeluaran *" 
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-[12px] sm:text-sm text-text-primary outline-none focus:border-primary transition-colors" 
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:gap-2 bg-black/5 dark:bg-black/20 border border-border rounded-xl p-2.5 sm:p-3">
                  {amounts.map((amt, idx) => (
                    <div key={idx} className="flex gap-1.5 sm:gap-2">
                      <input 
                        type="text" 
                        required 
                        value={amt === '' ? '' : formatCurrency(parseFloat(amt.replace(/[^0-9]/g, '')) || 0, 'IDR')} 
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          const newAmounts = [...amounts];
                          newAmounts[idx] = raw;
                          setAmounts(newAmounts);
                        }} 
                        placeholder={`Nominal ${idx + 1} *`} 
                        className="flex-1 bg-white dark:bg-black/60 border border-border rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-[12px] sm:text-sm font-bold text-danger outline-none focus:border-danger transition-colors shadow-sm" 
                      />
                      {amounts.length > 1 && (
                        <button type="button" onClick={() => setAmounts(amounts.filter((_, i) => i !== idx))} className="px-2.5 sm:px-3 text-text-muted hover:bg-danger/10 hover:text-danger rounded-lg transition-colors border border-transparent">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  <div className="flex justify-between items-center mt-0.5 px-1">
                    <button type="button" onClick={() => setAmounts([...amounts, ''])} className="text-[11px] sm:text-xs font-bold text-primary hover:text-primary-light flex items-center gap-1 p-1 rounded-lg hover:bg-primary/10 transition-colors">
                      <Plus size={12} /> Tambah Nominal
                    </button>
                    <div className="text-[11px] sm:text-sm font-black text-danger bg-danger/10 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-danger/20 shadow-sm">
                      Total: {formatCurrency(amounts.reduce((sum, val) => sum + (parseFloat(val.replace(/[^0-9]/g, '')) || 0), 0), 'IDR')}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none text-text-muted">
                    <Calendar size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <input 
                    type="date" 
                    required 
                    value={formData.date || ''} 
                    onChange={e => setFormData({...formData, date: e.target.value})} 
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg pl-9 pr-3 py-2 sm:pl-11 sm:pr-4 sm:py-3 text-[12px] sm:text-sm text-text-primary outline-none focus:border-primary transition-colors" 
                    title="Tanggal Pengeluaran"
                  />
                </div>

                <div>
                  <textarea 
                    rows={2} 
                    value={formData.notes || ''} 
                    onChange={e => setFormData({...formData, notes: e.target.value})} 
                    placeholder="Catatan Tambahan (Opsional)..." 
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-[12px] sm:text-sm text-text-primary outline-none focus:border-primary transition-colors custom-scrollbar" 
                  />
                </div>

                <div className="flex justify-end gap-2.5 sm:gap-3 mt-1 sm:mt-2 pt-3 sm:pt-4 border-t border-border shrink-0">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[11px] sm:text-sm font-bold">Batal</button>
                  <button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-white px-5 py-2 sm:px-6 sm:py-2.5 rounded-lg transition-transform active:scale-95 text-[11px] sm:text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center min-w-[100px] sm:min-w-[120px]">
                    {saving ? <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
