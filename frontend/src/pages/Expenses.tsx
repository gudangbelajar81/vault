import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import {
  Wallet,
  Plus,
  Edit2,
  Trash2,
  X,
  TrendingDown,
  DollarSign,
  Calendar,
  Tag,
  FileText,
  Download,
  Upload,
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  PauseCircle,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Clipboard,
  Bookmark,
  PieChart,
  CheckSquare,
  Search,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { API_URL } from '../config';
import { useVaultStore } from '../store/vaultStore';
import { encryptData, decryptData } from '../utils/crypto';
import toast from 'react-hot-toast';

interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  accountNumber?: string | null;
  notes?: string | null;
}

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
  decryptedNotes?: { url?: string; password?: string };
}

interface BillProfile {
  id: string;
  name: string;
  category: string;
  accountNumber: string;
  provider?: string | null;
  notes?: string | null;
}

const EXPENSES_API = `${API_URL}/api/expenses`;
const SUBS_API = `${API_URL}/api/subscriptions`;
const PROFILES_API = `${API_URL}/api/expenses/bill-profiles`;

const formatCurrency = (amount: number, currency: string = 'IDR') => {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'id-ID', {
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
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-semibold">
          <CheckCircle size={10} /> Aktif
        </span>
      );
    case 'paused':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-semibold">
          <PauseCircle size={10} /> Dijeda
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/15 text-danger text-[10px] font-semibold">
          <X size={10} /> Dibatalkan
        </span>
      );
    default:
      return null;
  }
};

const getDueBadge = (days: number, status: string) => {
  if (status !== 'active') return null;
  if (days < 0) return <span className="text-[10px] text-danger font-bold">Terlambat!</span>;
  if (days === 0) return <span className="text-[10px] text-danger font-bold animate-pulse">Hari ini!</span>;
  if (days <= 3) return <span className="text-[10px] text-warning font-semibold">{days} hari lagi</span>;
  if (days <= 7) return <span className="text-[10px] text-info font-medium">{days} hari lagi</span>;
  return <span className="text-[10px] text-text-muted">{days} hari lagi</span>;
};

const getEmptySubForm = () => ({
  id: Date.now().toString() + Math.random(),
  name: '',
  price: '' as number | '',
  currency: 'IDR',
  billingCycle: 'monthly',
  nextBillingDate: new Date().toISOString().split('T')[0],
  status: 'active',
  accountEmail: '',
  url: '',
  password: '',
});

export const Expenses: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'expenses';

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const { masterPassword } = useVaultStore();

  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [billProfiles, setBillProfiles] = useState<BillProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [expenseSearch, setExpenseSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('all');
  const [profileSearch, setProfileSearch] = useState('');

  // Password visibility map for subscriptions
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Expense modal states
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [expenseFormData, setExpenseFormData] = useState<Partial<Expense> & { saveAsProfile?: boolean; profileName?: string }>({
    currency: 'IDR',
    category: 'Lain-lain',
    date: new Date().toISOString().split('T')[0],
  });
  const [amounts, setAmounts] = useState<string[]>(['']);
  const [savingExpense, setSavingExpense] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscription modal states
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [subFormsData, setSubFormsData] = useState<ReturnType<typeof getEmptySubForm>[]>([getEmptySubForm()]);
  const [savingSub, setSavingSub] = useState(false);

  // Bill Profile modal states
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<BillProfile | null>(null);
  const [profileFormData, setProfileFormData] = useState<Partial<BillProfile>>({
    category: 'Tagihan Bulanan',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Quick Action state (recording bill payment)
  const [payingSubId, setPayingSubId] = useState<string | null>(null);

  // Load all initial data
  const loadData = async () => {
    try {
      setLoading(true);
      const [expRes, subRes, profRes] = await Promise.all([
        axios.get(EXPENSES_API, { withCredentials: true }).catch(() => ({ data: { data: [] } })),
        axios.get(SUBS_API, { withCredentials: true }).catch(() => ({ data: { data: [] } })),
        axios.get(PROFILES_API, { withCredentials: true }).catch(() => ({ data: { data: [] } })),
      ]);

      const expList: Expense[] = expRes.data.data || [];
      const subList: Subscription[] = subRes.data.data || [];
      const profList: BillProfile[] = profRes.data.data || [];

      // Decrypt subscriptions notes if masterPassword is ready
      if (masterPassword) {
        for (const item of subList) {
          if (item.encryptedNotes) {
            try {
              const decrypted = await decryptData(item.encryptedNotes, masterPassword);
              item.decryptedNotes = JSON.parse(decrypted);
            } catch {
              // Ignore decryption failure on bad key
            }
          }
        }
      }

      setExpenses(expList);
      setSubscriptions(subList);
      setBillProfiles(profList);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [masterPassword]);

  // Copy helper
  const copyToClipboard = async (text: string, label: string = 'Nomor') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} berhasil disalin!`);
    } catch {
      toast.error('Gagal menyalin ke clipboard');
    }
  };

  // Paste helper
  const pasteFromClipboard = async (onPasted: (val: string) => void) => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        toast.error('Clipboard kosong');
        return;
      }
      onPasted(text.trim());
      toast.success('Berhasil ditempel!');
    } catch {
      toast.error('Izin membaca clipboard ditolak');
    }
  };

  // Unique categories for expenses filter & suggestions
  const uniqueCategories = useMemo(() => {
    const defaultCats = ['Makanan', 'Transportasi', 'Tagihan Listrik', 'Internet', 'Pendidikan', 'Belanja', 'Kesehatan', 'Lain-lain'];
    const fromExp = expenses.map(e => e.category).filter(Boolean);
    const fromProf = billProfiles.map(p => p.category).filter(Boolean);
    return Array.from(new Set([...defaultCats, ...fromExp, ...fromProf]));
  }, [expenses, billProfiles]);

  // KPI Calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const thisMonthExpenses = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
  }, [expenses, currentYear, currentMonth]);

  const totalThisMonthIDR = useMemo(() => {
    return thisMonthExpenses.reduce((sum, e) => {
      const val = e.currency === 'USD' ? e.amount * 16000 : e.amount;
      return sum + val;
    }, 0);
  }, [thisMonthExpenses]);

  const activeSubs = useMemo(() => subscriptions.filter(s => s.status === 'active'), [subscriptions]);

  const totalMonthlySubsIDR = useMemo(() => {
    return activeSubs.reduce((sum, s) => {
      const val = s.currency === 'USD' ? s.price * 16000 : s.price;
      return sum + (s.billingCycle === 'yearly' ? val / 12 : val);
    }, 0);
  }, [activeSubs]);

  const dueSoonSubs = useMemo(() => {
    return activeSubs.filter(s => {
      const d = getDaysUntil(s.nextBillingDate);
      return d >= 0 && d <= 7;
    });
  }, [activeSubs]);

  // Routine Checklist calculation: Subscriptions & Bill Profiles vs this month's payments
  const routineChecklist = useMemo(() => {
    const list: Array<{
      type: 'sub' | 'profile';
      id: string;
      title: string;
      identifier: string;
      amount?: number;
      currency?: string;
      isPaid: boolean;
      paidDate?: string;
      rawObj: Subscription | BillProfile;
    }> = [];

    // Map active subscriptions
    activeSubs.forEach(sub => {
      // Considered paid if an expense exists this month matching title or notes
      const subNameLower = sub.name.toLowerCase();
      const match = thisMonthExpenses.find(e => {
        const titleLower = e.title.toLowerCase();
        return (
          titleLower.includes(subNameLower) ||
          subNameLower.includes(titleLower) ||
          (e.accountNumber && sub.accountEmail && e.accountNumber.toLowerCase() === sub.accountEmail.toLowerCase())
        );
      });
      list.push({
        type: 'sub',
        id: sub.id,
        title: sub.name,
        identifier: sub.accountEmail || `${sub.billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'}`,
        amount: sub.price,
        currency: sub.currency,
        isPaid: !!match,
        paidDate: match?.date,
        rawObj: sub,
      });
    });

    // Map bill profiles
    billProfiles.forEach(prof => {
      const profNameLower = prof.name.toLowerCase();
      const profAcc = (prof.accountNumber || '').toLowerCase();
      const match = thisMonthExpenses.find(e => {
        const titleLower = e.title.toLowerCase();
        const accLower = (e.accountNumber || '').toLowerCase();
        return (
          titleLower.includes(profNameLower) ||
          profNameLower.includes(titleLower) ||
          (profAcc && accLower && profAcc === accLower)
        );
      });
      list.push({
        type: 'profile',
        id: prof.id,
        title: prof.name,
        identifier: prof.accountNumber,
        isPaid: !!match,
        paidDate: match?.date,
        rawObj: prof,
      });
    });

    return list;
  }, [activeSubs, billProfiles, thisMonthExpenses]);

  const routinePaidCount = routineChecklist.filter(item => item.isPaid).length;

  // ==========================================
  // EXPENSES HANDLERS
  // ==========================================
  const openAddExpense = (prefill?: { title?: string; category?: string; accountNumber?: string; amount?: number; currency?: string; notes?: string }) => {
    setEditExpense(null);
    setExpenseFormData({
      title: prefill?.title || '',
      category: prefill?.category || 'Lain-lain',
      accountNumber: prefill?.accountNumber || '',
      currency: prefill?.currency || 'IDR',
      date: new Date().toISOString().split('T')[0],
      notes: prefill?.notes || '',
      saveAsProfile: false,
      profileName: '',
    });
    setAmounts([prefill?.amount !== undefined ? prefill.amount.toString() : '']);
    setExpenseModalOpen(true);
  };

  const openEditExpense = (item: Expense) => {
    setEditExpense(item);
    setExpenseFormData({
      title: item.title,
      category: item.category,
      accountNumber: item.accountNumber || '',
      currency: item.currency,
      date: item.date.split('T')[0],
      notes: item.notes || '',
    });
    setAmounts([item.amount.toString()]);
    setExpenseModalOpen(true);
  };

  const handleAmountChange = (index: number, val: string) => {
    const updated = [...amounts];
    updated[index] = val;
    setAmounts(updated);
  };

  const addAmountField = () => setAmounts([...amounts, '']);
  const removeAmountField = (index: number) => {
    if (amounts.length <= 1) return;
    setAmounts(amounts.filter((_, i) => i !== index));
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseFormData.title?.trim()) {
      toast.error('Judul pengeluaran wajib diisi');
      return;
    }

    setSavingExpense(true);
    try {
      if (editExpense) {
        const total = parseFloat(amounts[0]) || 0;
        await axios.put(
          `${EXPENSES_API}/${editExpense.id}`,
          {
            ...expenseFormData,
            amount: total,
          },
          { withCredentials: true }
        );
        toast.success('Pengeluaran berhasil diperbarui');
      } else {
        const validAmounts = amounts.map(a => parseFloat(a)).filter(n => !isNaN(n) && n > 0);
        if (validAmounts.length === 0) validAmounts.push(0);

        await Promise.all(
          validAmounts.map((amt, idx) =>
            axios.post(
              EXPENSES_API,
              {
                ...expenseFormData,
                title: validAmounts.length > 1 ? `${expenseFormData.title} (${idx + 1})` : expenseFormData.title,
                amount: amt,
              },
              { withCredentials: true }
            )
          )
        );
        toast.success('Pengeluaran berhasil dicatat');
      }
      setExpenseModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan pengeluaran');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string, title: string) => {
    if (!window.confirm(`Hapus pengeluaran "${title}"?`)) return;
    try {
      await axios.delete(`${EXPENSES_API}/${id}`, { withCredentials: true });
      toast.success('Pengeluaran berhasil dihapus');
      loadData();
    } catch {
      toast.error('Gagal menghapus pengeluaran');
    }
  };

  // Profile selector inside expense form
  const handleSelectProfileForExpense = (profId: string) => {
    const prof = billProfiles.find(p => p.id === profId);
    if (!prof) return;
    setExpenseFormData(prev => ({
      ...prev,
      title: prev.title || prof.name,
      category: prof.category || prev.category,
      accountNumber: prof.accountNumber,
      notes: prof.notes || prev.notes,
    }));
    toast.success(`Profil "${prof.name}" dipilih`);
  };

  // CSV Export (7 columns)
  const handleExportCSV = () => {
    if (expenses.length === 0) return toast.error('Belum ada data untuk diekspor');
    const headers = ['Tanggal', 'Judul', 'Kategori', 'No. Akun/Registrasi', 'Jumlah', 'Mata Uang', 'Catatan'];
    const rows = expenses.map(exp => [
      new Date(exp.date).toISOString().split('T')[0],
      `"${(exp.title || '').replace(/"/g, '""')}"`,
      `"${(exp.category || '').replace(/"/g, '""')}"`,
      `"${(exp.accountNumber || '').replace(/"/g, '""')}"`,
      exp.amount,
      exp.currency,
      `"${(exp.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pengeluaran_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import (supports 6 or 7 columns)
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) return toast.error('File CSV kosong atau tidak valid');

      const dataLines = lines.slice(1);
      let successCount = 0;

      for (const line of dataLines) {
        const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
        const matches = line.match(/(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g);

        if (!matches) continue;
        const cols = matches.map(m => {
          let s = m.replace(/^,/, '').trim();
          if (s.startsWith('"') && s.endsWith('"')) {
            s = s.slice(1, -1).replace(/""/g, '"');
          }
          return s;
        });

        if (cols.length >= 6) {
          let dateStr = cols[0];
          let title = cols[1];
          let category = cols[2];
          let accountNumber = '';
          let amountStr = '';
          let currency = 'IDR';
          let notes = '';

          if (cols.length >= 7) {
            accountNumber = cols[3];
            amountStr = cols[4];
            currency = cols[5] || 'IDR';
            notes = cols[6] || '';
          } else {
            amountStr = cols[3];
            currency = cols[4] || 'IDR';
            notes = cols[5] || '';
          }

          const amount = parseFloat(amountStr) || 0;
          if (title && !isNaN(amount)) {
            try {
              await axios.post(
                EXPENSES_API,
                {
                  title,
                  category,
                  accountNumber: accountNumber || null,
                  amount,
                  currency,
                  date: new Date(dateStr).toISOString(),
                  notes,
                },
                { withCredentials: true }
              );
              successCount++;
            } catch {
              // Ignore single row failure
            }
          }
        }
      }

      toast.success(`Berhasil mengimpor ${successCount} data`);
      loadData();
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // ==========================================
  // SUBSCRIPTIONS HANDLERS
  // ==========================================
  const openAddSub = () => {
    setEditSubId(null);
    setSubFormsData([getEmptySubForm()]);
    setSubModalOpen(true);
  };

  const openEditSub = (sub: Subscription) => {
    setEditSubId(sub.id);
    setSubFormsData([
      {
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
      },
    ]);
    setSubModalOpen(true);
  };

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSub(true);
    try {
      const processedForms = await Promise.all(
        subFormsData.map(async data => {
          let encryptedNotes = '';
          if (data.url || data.password) {
            if (!masterPassword) {
              throw new Error('Master password diperlukan untuk mengenkripsi akun/password');
            }
            const notesObj = { url: data.url, password: data.password };
            encryptedNotes = await encryptData(JSON.stringify(notesObj), masterPassword);
          }
          return {
            ...data,
            encryptedNotes: encryptedNotes || undefined,
          };
        })
      );

      if (editSubId) {
        await axios.put(`${SUBS_API}/${editSubId}`, processedForms[0], { withCredentials: true });
        toast.success('Langganan berhasil diperbarui');
      } else {
        await Promise.all(processedForms.map(d => axios.post(SUBS_API, d, { withCredentials: true })));
        toast.success('Langganan berhasil ditambahkan');
      }
      setSubModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan langganan');
    } finally {
      setSavingSub(false);
    }
  };

  const handleDeleteSub = async (id: string, name: string) => {
    if (!window.confirm(`Hapus langganan "${name}"?`)) return;
    try {
      await axios.delete(`${SUBS_API}/${id}`, { withCredentials: true });
      toast.success('Langganan berhasil dihapus');
      loadData();
    } catch {
      toast.error('Gagal menghapus langganan');
    }
  };

  // 1-Click Pay Subscription: Records Expense + Advances Next Billing Date
  const handlePaySubscriptionMonth = async (sub: Subscription) => {
    if (!window.confirm(`Catat pembayaran "${sub.name}" sebesar ${formatCurrency(sub.price, sub.currency)} untuk bulan ini?`)) {
      return;
    }
    setPayingSubId(sub.id);
    try {
      // 1. Post expense
      await axios.post(
        EXPENSES_API,
        {
          title: `Langganan: ${sub.name}`,
          amount: sub.price,
          currency: sub.currency,
          category: 'Langganan',
          date: new Date().toISOString(),
          accountNumber: sub.accountEmail || null,
          notes: `Pembayaran siklus ${sub.billingCycle === 'yearly' ? 'tahunan' : 'bulanan'}`,
        },
        { withCredentials: true }
      );

      // 2. Advance nextBillingDate
      const nextDate = new Date(sub.nextBillingDate);
      if (sub.billingCycle === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }

      await axios.put(
        `${SUBS_API}/${sub.id}`,
        {
          name: sub.name,
          price: sub.price,
          currency: sub.currency,
          billingCycle: sub.billingCycle,
          nextBillingDate: nextDate.toISOString().split('T')[0],
          status: 'active',
          accountEmail: sub.accountEmail || '',
        },
        { withCredentials: true }
      );

      toast.success(`Pembayaran "${sub.name}" dicatat & jatuh tempo diperbarui ke ${nextDate.toLocaleDateString('id-ID')}`);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memproses pembayaran');
    } finally {
      setPayingSubId(null);
    }
  };

  // ==========================================
  // BILL PROFILES HANDLERS
  // ==========================================
  const openAddProfile = () => {
    setEditProfile(null);
    setProfileFormData({
      name: '',
      category: 'Tagihan Bulanan',
      accountNumber: '',
      provider: '',
      notes: '',
    });
    setProfileModalOpen(true);
  };

  const openEditProfile = (prof: BillProfile) => {
    setEditProfile(prof);
    setProfileFormData({
      name: prof.name,
      category: prof.category,
      accountNumber: prof.accountNumber,
      provider: prof.provider || '',
      notes: prof.notes || '',
    });
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileFormData.name?.trim() || !profileFormData.accountNumber?.trim()) {
      toast.error('Nama dan Nomor Akun wajib diisi');
      return;
    }
    setSavingProfile(true);
    try {
      if (editProfile) {
        await axios.put(`${PROFILES_API}/${editProfile.id}`, profileFormData, { withCredentials: true });
        toast.success('Profil tagihan diperbarui');
      } else {
        await axios.post(PROFILES_API, profileFormData, { withCredentials: true });
        toast.success('Profil tagihan disimpan');
      }
      setProfileModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan profil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteProfile = async (id: string, name: string) => {
    if (!window.confirm(`Hapus profil tagihan "${name}"?`)) return;
    try {
      await axios.delete(`${PROFILES_API}/${id}`, { withCredentials: true });
      toast.success('Profil tagihan dihapus');
      loadData();
    } catch {
      toast.error('Gagal menghapus profil');
    }
  };

  // Quick Pay from Profile: opens expense modal pre-filled
  const handleQuickPayFromProfile = (prof: BillProfile) => {
    openAddExpense({
      title: `Bayar ${prof.name}`,
      category: prof.category || 'Tagihan Bulanan',
      accountNumber: prof.accountNumber,
      notes: prof.notes || '',
    });
  };

  // Filtered lists
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchSearch =
        (exp.title || '').toLowerCase().includes(expenseSearch.toLowerCase()) ||
        (exp.accountNumber || '').toLowerCase().includes(expenseSearch.toLowerCase()) ||
        (exp.notes || '').toLowerCase().includes(expenseSearch.toLowerCase());
      const matchCat = selectedCategory === 'all' || exp.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [expenses, expenseSearch, selectedCategory]);

  const filteredSubs = useMemo(() => {
    return subscriptions.filter(sub => {
      const matchSearch =
        (sub.name || '').toLowerCase().includes(subSearch.toLowerCase()) ||
        (sub.accountEmail || '').toLowerCase().includes(subSearch.toLowerCase());
      const matchStatus = subStatusFilter === 'all' || sub.status === subStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [subscriptions, subSearch, subStatusFilter]);

  const filteredProfiles = useMemo(() => {
    return billProfiles.filter(prof => {
      return (
        (prof.name || '').toLowerCase().includes(profileSearch.toLowerCase()) ||
        (prof.accountNumber || '').toLowerCase().includes(profileSearch.toLowerCase()) ||
        (prof.category || '').toLowerCase().includes(profileSearch.toLowerCase())
      );
    });
  }, [billProfiles, profileSearch]);

  // Category breakdown for Laporan tab
  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthExpenses.forEach(e => {
      const cat = e.category || 'Lain-lain';
      const val = e.currency === 'USD' ? e.amount * 16000 : e.amount;
      map[cat] = (map[cat] || 0) + val;
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [thisMonthExpenses]);

  return (
    <div className="h-full flex flex-col space-y-3 pb-8">
      {/* Header with Title & Tab Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-border">
        <div>
          <h2 className="text-lg font-black text-text-primary flex items-center gap-2">
            <Wallet className="text-primary" size={20} />
            Pengeluaran & Subs
          </h2>
          <p className="text-xs text-text-muted">Hub terpadu pengeluaran harian, langganan rutin, profil tagihan, dan checklist bulanan.</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-surface/80 p-1 border border-border rounded-xl backdrop-blur-sm self-stretch sm:self-auto overflow-x-auto">
          <button
            onClick={() => setTab('expenses')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'expenses' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Wallet size={13} />
            Pengeluaran ({expenses.length})
          </button>
          <button
            onClick={() => setTab('subs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'subs' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <CreditCard size={13} />
            Langganan ({subscriptions.length})
          </button>
          <button
            onClick={() => setTab('profiles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'profiles' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Bookmark size={13} />
            Profil Tagihan ({billProfiles.length})
          </button>
          <button
            onClick={() => setTab('laporan')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'laporan' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <PieChart size={13} />
            Laporan & Checklist
          </button>
        </div>
      </div>

      {/* KPI Cards (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-surface/60 border border-border rounded-xl p-3 backdrop-blur-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-text-muted font-medium">Bulan Ini (Total)</span>
            <div className="w-6 h-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <TrendingDown size={13} />
            </div>
          </div>
          <p className="text-base font-black text-text-primary truncate">{formatCurrency(totalThisMonthIDR, 'IDR')}</p>
          <p className="text-[10px] text-text-muted mt-0.5">{thisMonthExpenses.length} transaksi tercatat</p>
        </div>

        <div className="bg-surface/60 border border-border rounded-xl p-3 backdrop-blur-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-text-muted font-medium">Subs Aktif / Bln</span>
            <div className="w-6 h-6 rounded-lg bg-success/15 text-success flex items-center justify-center">
              <TrendingUp size={13} />
            </div>
          </div>
          <p className="text-base font-black text-text-primary truncate">{formatCurrency(totalMonthlySubsIDR, 'IDR')}</p>
          <p className="text-[10px] text-text-muted mt-0.5">{activeSubs.length} langganan aktif</p>
        </div>

        <div className={`bg-surface/60 border rounded-xl p-3 backdrop-blur-sm flex flex-col justify-between ${dueSoonSubs.length > 0 ? 'border-warning/50 bg-warning/5' : 'border-border'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-text-muted font-medium">Tempo (&le; 7 Hari)</span>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${dueSoonSubs.length > 0 ? 'bg-warning/20 text-warning' : 'bg-info/15 text-info'}`}>
              <AlertCircle size={13} />
            </div>
          </div>
          <p className="text-base font-black text-text-primary">{dueSoonSubs.length}</p>
          <p className="text-[10px] text-text-muted mt-0.5">{dueSoonSubs.length > 0 ? 'Segera periksa tagihan' : 'Semua aman'}</p>
        </div>

        <div className="bg-surface/60 border border-border rounded-xl p-3 backdrop-blur-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-text-muted font-medium">Checklist Rutin</span>
            <div className="w-6 h-6 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center">
              <CheckSquare size={13} />
            </div>
          </div>
          <p className="text-base font-black text-text-primary">
            {routinePaidCount} / {routineChecklist.length} <span className="text-xs font-semibold text-text-muted">Lunas</span>
          </p>
          <div className="w-full bg-border rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${routineChecklist.length > 0 ? (routinePaidCount / routineChecklist.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* ======================================================== */}
        {/* TAB 1: PENGELUARAN (EXPENSES)                            */}
        {/* ======================================================== */}
        {activeTab === 'expenses' && (
          <div className="flex-1 flex flex-col space-y-2.5">
            {/* Action Bar: Search, Category Filter, Export, Import, Add */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-surface/40 p-2.5 border border-border rounded-xl">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" size={13} />
                  <input
                    type="text"
                    value={expenseSearch}
                    onChange={e => setExpenseSearch(e.target.value)}
                    placeholder="Cari pengeluaran, nomor akun, catatan..."
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                  {expenseSearch && (
                    <button onClick={() => setExpenseSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Semua Kategori</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Impor CSV"
                  className="p-1.5 bg-black/5 dark:bg-black/40 border border-border hover:border-primary text-text-muted hover:text-primary rounded-lg text-xs transition-colors flex items-center gap-1"
                >
                  <Upload size={13} /> <span className="hidden md:inline">Impor</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  title="Ekspor CSV"
                  className="p-1.5 bg-black/5 dark:bg-black/40 border border-border hover:border-primary text-text-muted hover:text-primary rounded-lg text-xs transition-colors flex items-center gap-1"
                >
                  <Download size={13} /> <span className="hidden md:inline">Ekspor</span>
                </button>
                <button
                  onClick={() => openAddExpense()}
                  className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                >
                  <Plus size={14} /> Catat Pengeluaran
                </button>
              </div>
            </div>

            {/* Expenses Table */}
            <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-y-auto backdrop-blur-sm">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-text-muted">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-text-muted py-14 opacity-60">
                  <Wallet size={36} className="mb-2" />
                  <p className="text-xs font-bold">Tidak ada pengeluaran yang cocok.</p>
                  <p className="text-[11px] mt-0.5">Klik tombol di atas untuk mencatat pengeluaran baru.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface/40">
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Tanggal & Judul</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Kategori</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider hidden md:table-cell">No. Akun / Pelanggan</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Jumlah</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider hidden lg:table-cell">Catatan</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold text-text-muted uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredExpenses.map(item => (
                      <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-3 py-2">
                          <p className="font-bold text-text-primary text-xs">{item.title}</p>
                          <p className="text-[10px] text-text-muted">{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold">{item.category}</span>
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          {item.accountNumber ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-text-primary bg-black/5 dark:bg-black/40 px-1.5 py-0.5 rounded border border-border">{item.accountNumber}</span>
                              <button
                                onClick={() => copyToClipboard(item.accountNumber!, 'Nomor akun')}
                                title="Salin nomor akun"
                                className="text-text-muted hover:text-primary p-1 rounded transition-colors"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-text-muted">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-black text-xs text-text-primary">{formatCurrency(item.amount, item.currency)}</p>
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell">
                          <p className="text-[11px] text-text-muted truncate max-w-xs">{item.notes || '-'}</p>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditExpense(item)}
                              title="Edit"
                              className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(item.id, item.title)}
                              title="Hapus"
                              className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: SUBSCRIPTIONS (LANGGANAN)                         */}
        {/* ======================================================== */}
        {activeTab === 'subs' && (
          <div className="flex-1 flex flex-col space-y-2.5">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-surface/40 p-2.5 border border-border rounded-xl">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" size={13} />
                  <input
                    type="text"
                    value={subSearch}
                    onChange={e => setSubSearch(e.target.value)}
                    placeholder="Cari langganan atau email..."
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                  {subSearch && (
                    <button onClick={() => setSubSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                      <X size={12} />
                    </button>
                  )}
                </div>

                <select
                  value={subStatusFilter}
                  onChange={e => setSubStatusFilter(e.target.value)}
                  className="bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="paused">Dijeda</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
              </div>

              <button
                onClick={openAddSub}
                className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
              >
                <Plus size={14} /> Tambah Langganan
              </button>
            </div>

            {/* Subscriptions List */}
            <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-y-auto backdrop-blur-sm">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-text-muted">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                </div>
              ) : filteredSubs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-text-muted py-14 opacity-60">
                  <CreditCard size={36} className="mb-2" />
                  <p className="text-xs font-bold">Belum ada langganan yang cocok.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface/40">
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Layanan</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">Biaya & Siklus</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider hidden sm:table-cell">Jatuh Tempo</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider hidden md:table-cell">Kredensial</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider hidden sm:table-cell">Status</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold text-text-muted uppercase tracking-wider">Aksi & Bayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSubs.map(item => {
                      const days = getDaysUntil(item.nextBillingDate);
                      const isPaying = payingSubId === item.id;
                      const hasCreds = item.decryptedNotes?.password || item.decryptedNotes?.url || item.accountEmail;
                      const showPassword = showPasswordMap[item.id] || false;

                      return (
                        <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                          {/* Name */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center font-black text-white text-xs">
                                {item.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-text-primary text-xs">{item.name}</p>
                                  {item.decryptedNotes?.url && (
                                    <a
                                      href={item.decryptedNotes.url.startsWith('http') ? item.decryptedNotes.url : `https://${item.decryptedNotes.url}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-text-muted hover:text-primary transition-colors"
                                      title="Buka situs"
                                    >
                                      <ExternalLink size={10} />
                                    </a>
                                  )}
                                </div>
                                <p className="text-[10px] text-text-muted">{item.accountEmail || 'Tanpa email terdaftar'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Price */}
                          <td className="px-3 py-2">
                            <p className="font-black text-xs text-text-primary">{formatCurrency(item.price, item.currency)}</p>
                            <p className="text-[10px] text-text-muted capitalize">{item.billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'}</p>
                          </td>

                          {/* Next Billing */}
                          <td className="px-3 py-2 hidden sm:table-cell">
                            <p className="text-xs text-text-primary font-medium">
                              {new Date(item.nextBillingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <div className="mt-0.5">{getDueBadge(days, item.status)}</div>
                          </td>

                          {/* Credentials (Email & Password with toggle) */}
                          <td className="px-3 py-2 hidden md:table-cell">
                            {hasCreds ? (
                              <div className="flex flex-col gap-0.5">
                                {item.accountEmail && (
                                  <div className="flex items-center gap-1 text-[11px] text-text-muted">
                                    <span className="truncate max-w-[120px]">{item.accountEmail}</span>
                                    <button onClick={() => copyToClipboard(item.accountEmail!, 'Email')} className="hover:text-primary">
                                      <Copy size={10} />
                                    </button>
                                  </div>
                                )}
                                {item.decryptedNotes?.password ? (
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <span className="font-mono text-text-primary">
                                      {showPassword ? item.decryptedNotes.password : '••••••••'}
                                    </span>
                                    <button
                                      onClick={() => setShowPasswordMap(prev => ({ ...prev, [item.id]: !showPassword }))}
                                      className="text-text-muted hover:text-text-primary"
                                      title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                                    >
                                      {showPassword ? <EyeOff size={10} /> : <Eye size={10} />}
                                    </button>
                                    <button onClick={() => copyToClipboard(item.decryptedNotes!.password!, 'Password')} className="text-text-muted hover:text-primary">
                                      <Copy size={10} />
                                    </button>
                                  </div>
                                ) : item.encryptedNotes ? (
                                  <span className="text-[10px] text-text-muted flex items-center gap-1">
                                    <ShieldCheck size={10} className="text-primary" /> Terenkripsi
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-[11px] text-text-muted">-</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2 hidden sm:table-cell">{getStatusBadge(item.status)}</td>

                          {/* Actions */}
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1-Click Pay Month */}
                              <button
                                onClick={() => handlePaySubscriptionMonth(item)}
                                disabled={isPaying}
                                title="Catat bayar bulan ini & majukan jatuh tempo"
                                className="px-2 py-1 bg-success/15 hover:bg-success/25 text-success rounded text-[10px] font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                              >
                                {isPaying ? <RefreshCw size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                                <span className="hidden lg:inline">Catat Bayar</span>
                              </button>
                              <button
                                onClick={() => openEditSub(item)}
                                title="Edit"
                                className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteSub(item.id, item.name)}
                                title="Hapus"
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
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: PROFIL TAGIHAN (BILL PROFILES)                    */}
        {/* ======================================================== */}
        {activeTab === 'profiles' && (
          <div className="flex-1 flex flex-col space-y-2.5">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-surface/40 p-2.5 border border-border rounded-xl">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" size={13} />
                <input
                  type="text"
                  value={profileSearch}
                  onChange={e => setProfileSearch(e.target.value)}
                  placeholder="Cari nama tagihan, no. pelanggan PLN, internet, BPJS..."
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
                {profileSearch && (
                  <button onClick={() => setProfileSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                onClick={openAddProfile}
                className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
              >
                <Plus size={14} /> Tambah Profil Tagihan
              </button>
            </div>

            {/* Profiles Grid */}
            <div className="flex-1 bg-surface/30 border border-border rounded-xl p-3 overflow-y-auto backdrop-blur-sm">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-text-muted">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-text-muted py-14 opacity-60">
                  <Bookmark size={36} className="mb-2" />
                  <p className="text-xs font-bold">Belum ada profil tagihan tersimpan.</p>
                  <p className="text-[11px] mt-0.5">Simpan nomor PLN, Wi-Fi Indihome, BPJS agar tidak perlu ketik ulang setiap bulan.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredProfiles.map(prof => (
                    <div key={prof.id} className="bg-surface/70 border border-border hover:border-primary/40 rounded-xl p-3 flex flex-col justify-between transition-all group shadow-sm">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <span className="inline-block px-1.5 py-0.5 rounded bg-secondary/15 text-secondary text-[10px] font-bold">{prof.category}</span>
                            <h4 className="font-bold text-text-primary text-xs mt-1">{prof.name}</h4>
                          </div>
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                            <button
                              onClick={() => openEditProfile(prof)}
                              title="Edit profil"
                              className="p-1 text-text-muted hover:text-primary hover:bg-primary/10 rounded"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteProfile(prof.id, prof.name)}
                              title="Hapus profil"
                              className="p-1 text-text-muted hover:text-danger hover:bg-danger/10 rounded"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Account Number Box with One-Click Copy */}
                        <div className="bg-black/5 dark:bg-black/50 border border-border rounded-lg p-2 flex items-center justify-between gap-2 my-2">
                          <div className="min-w-0">
                            <p className="text-[10px] text-text-muted font-medium">No. Akun / ID Pelanggan</p>
                            <p className="font-mono text-xs font-bold text-text-primary truncate">{prof.accountNumber}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(prof.accountNumber, `Nomor akun ${prof.name}`)}
                            title="Salin nomor"
                            className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <Copy size={10} /> Salin
                          </button>
                        </div>

                        {prof.notes && <p className="text-[11px] text-text-muted line-clamp-2 mb-2">{prof.notes}</p>}
                      </div>

                      {/* Quick Pay Action */}
                      <button
                        onClick={() => handleQuickPayFromProfile(prof)}
                        className="w-full mt-2 py-1.5 bg-primary/15 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Wallet size={12} /> Catat / Bayar Sekarang
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: LAPORAN & CHECKLIST BULANAN                       */}
        {/* ======================================================== */}
        {activeTab === 'laporan' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Burn Rate Summary Card */}
            <div className="bg-surface/50 border border-border rounded-xl p-3.5 backdrop-blur-sm">
              <h3 className="text-xs font-black text-text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <PieChart size={14} className="text-primary" /> Ringkasan Burn Rate Bulan Ini ({new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-black/5 dark:bg-black/40 border border-border rounded-lg p-2.5">
                  <p className="text-[10px] text-text-muted font-medium">Realisasi Pengeluaran</p>
                  <p className="text-sm font-black text-text-primary mt-0.5">{formatCurrency(totalThisMonthIDR, 'IDR')}</p>
                </div>
                <div className="bg-black/5 dark:bg-black/40 border border-border rounded-lg p-2.5">
                  <p className="text-[10px] text-text-muted font-medium">Budget Langganan Aktif</p>
                  <p className="text-sm font-black text-text-primary mt-0.5">{formatCurrency(totalMonthlySubsIDR, 'IDR')}</p>
                </div>
                <div className="bg-black/5 dark:bg-black/40 border border-border rounded-lg p-2.5">
                  <p className="text-[10px] text-text-muted font-medium">Estimasi Total Burn / Bulan</p>
                  <p className="text-sm font-black text-primary mt-0.5">{formatCurrency(totalThisMonthIDR + totalMonthlySubsIDR, 'IDR')}</p>
                </div>
              </div>
            </div>

            {/* Monthly Checklist Section */}
            <div className="bg-surface/50 border border-border rounded-xl p-3.5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-black text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare size={14} className="text-secondary" /> Checklist Tagihan Rutin Bulan Ini
                  </h3>
                  <p className="text-[11px] text-text-muted">Daftar langganan aktif & profil tagihan rutin yang harus dibayar bulan ini.</p>
                </div>
                <span className="text-xs font-black text-primary">
                  {routinePaidCount} / {routineChecklist.length} Selesai
                </span>
              </div>

              {routineChecklist.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs">Belum ada tagihan rutin atau langganan aktif.</div>
              ) : (
                <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {routineChecklist.map(item => (
                    <div key={`${item.type}-${item.id}`} className="p-2.5 flex items-center justify-between gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            item.isPaid ? 'bg-success/20 text-success' : 'bg-border text-text-muted'
                          }`}
                        >
                          <CheckCircle size={12} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-text-primary truncate">{item.title}</p>
                          <p className="text-[10px] text-text-muted truncate">
                            {item.type === 'sub' ? 'Langganan' : 'Profil Tagihan'} • {item.identifier}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.amount !== undefined && (
                          <span className="text-xs font-bold text-text-primary hidden sm:inline">
                            {formatCurrency(item.amount, item.currency || 'IDR')}
                          </span>
                        )}

                        {item.isPaid ? (
                          <span className="px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold">Lunas</span>
                        ) : (
                          <button
                            onClick={() => {
                              if (item.type === 'sub') {
                                handlePaySubscriptionMonth(item.rawObj as Subscription);
                              } else {
                                handleQuickPayFromProfile(item.rawObj as BillProfile);
                              }
                            }}
                            className="px-2 py-1 bg-primary hover:bg-primary/90 text-white rounded text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-transform"
                          >
                            Catat Bayar <ArrowRight size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category Breakdown Progress Bars */}
            <div className="bg-surface/50 border border-border rounded-xl p-3.5 backdrop-blur-sm">
              <h3 className="text-xs font-black text-text-primary uppercase tracking-wider mb-2">Breakdown Kategori Pengeluaran Bulan Ini</h3>

              {categoryStats.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs">Belum ada pengeluaran di bulan ini.</div>
              ) : (
                <div className="space-y-2">
                  {categoryStats.map(stat => (
                    <div key={stat.category} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-text-primary">{stat.category}</span>
                        <span className="text-text-muted">
                          {formatCurrency(stat.amount, 'IDR')} ({stat.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                        <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${stat.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL: TAMBAH / EDIT PENGELUARAN                         */}
      {/* ======================================================== */}
      {expenseModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-3.5 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <Wallet size={16} className="text-primary" /> {editExpense ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}
              </h3>
              <button onClick={() => setExpenseModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-3.5 space-y-3 overflow-y-auto flex-1">
              {/* Quick Fill from Bill Profile dropdown (Only in Add mode) */}
              {!editExpense && billProfiles.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5">
                  <label htmlFor="select-profile-fill" className="text-[11px] font-bold text-primary mb-1 flex items-center gap-1">
                    <Bookmark size={11} /> Pilih dari Profil Tagihan (Autofill Cepat)
                  </label>
                  <select
                    id="select-profile-fill"
                    onChange={e => {
                      if (e.target.value) handleSelectProfileForExpense(e.target.value);
                    }}
                    className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-primary"
                    defaultValue=""
                  >
                    <option value="">-- Pilih Profil Tagihan Tersimpan --</option>
                    {billProfiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.accountNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="expense-title" className="text-[11px] font-semibold text-text-muted mb-1 block">
                    Judul Pengeluaran *
                  </label>
                  <input
                    id="expense-title"
                    type="text"
                    required
                    value={expenseFormData.title || ''}
                    onChange={e => setExpenseFormData({ ...expenseFormData, title: e.target.value })}
                    placeholder="Contoh: Tagihan Listrik PLN"
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="expense-category" className="text-[11px] font-semibold text-text-muted mb-1 block">
                    Kategori
                  </label>
                  <input
                    id="expense-category"
                    type="text"
                    list="category-suggestions"
                    value={expenseFormData.category || ''}
                    onChange={e => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                    placeholder="Tagihan Listrik, Makanan, dll"
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary"
                  />
                  <datalist id="category-suggestions">
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Account Number with [Tempel] and [Salin] buttons */}
              <div>
                <label htmlFor="expense-account-number" className="text-[11px] font-semibold text-text-muted mb-1 flex items-center justify-between">
                  <span>No. Akun / ID Pelanggan / Rekening</span>
                  <span className="text-[10px] text-text-muted font-normal">(PLN, Wi-Fi, BPJS, VA)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="expense-account-number"
                    type="text"
                    value={expenseFormData.accountNumber || ''}
                    onChange={e => setExpenseFormData({ ...expenseFormData, accountNumber: e.target.value })}
                    placeholder="Contoh: 538291038291"
                    className="flex-1 font-mono bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => pasteFromClipboard(val => setExpenseFormData({ ...expenseFormData, accountNumber: val }))}
                    title="Tempel dari Clipboard"
                    className="px-2.5 py-1.5 bg-black/5 dark:bg-black/40 border border-border hover:border-primary text-text-muted hover:text-primary rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Clipboard size={12} /> Tempel
                  </button>
                  {expenseFormData.accountNumber && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(expenseFormData.accountNumber!, 'Nomor akun')}
                      title="Salin ke Clipboard"
                      className="px-2.5 py-1.5 bg-black/5 dark:bg-black/40 border border-border hover:border-primary text-text-muted hover:text-primary rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Copy size={12} /> Salin
                    </button>
                  )}
                </div>
              </div>

              {/* Amount & Currency */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-text-muted">Nominal (Jumlah) *</label>
                  {!editExpense && (
                    <button type="button" onClick={addAmountField} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                      <Plus size={10} /> Tambah Nominal Lain
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {amounts.map((amt, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="any"
                        required
                        value={amt}
                        onChange={e => handleAmountChange(idx, e.target.value)}
                        placeholder="0"
                        className="flex-1 bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary"
                      />
                      <select
                        value={expenseFormData.currency || 'IDR'}
                        onChange={e => setExpenseFormData({ ...expenseFormData, currency: e.target.value })}
                        className="bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary"
                      >
                        <option value="IDR">IDR</option>
                        <option value="USD">USD</option>
                      </select>
                      {amounts.length > 1 && !editExpense && (
                        <button type="button" onClick={() => removeAmountField(idx)} className="p-1.5 text-danger hover:bg-danger/10 rounded">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="expense-date" className="text-[11px] font-semibold text-text-muted mb-1 block">
                    Tanggal
                  </label>
                  <input
                    id="expense-date"
                    type="date"
                    required
                    value={expenseFormData.date || ''}
                    onChange={e => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="expense-notes" className="text-[11px] font-semibold text-text-muted mb-1 block">
                    Catatan
                  </label>
                  <input
                    id="expense-notes"
                    type="text"
                    value={expenseFormData.notes || ''}
                    onChange={e => setExpenseFormData({ ...expenseFormData, notes: e.target.value })}
                    placeholder="Opsional..."
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Checkbox: Save as Bill Profile */}
              {!editExpense && (
                <div className="pt-2 border-t border-border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!expenseFormData.saveAsProfile}
                      onChange={e => setExpenseFormData({ ...expenseFormData, saveAsProfile: e.target.checked })}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-text-primary font-medium">Simpan nomor ini sebagai Profil Tagihan untuk bulan depan</span>
                  </label>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-semibold text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                  {savingExpense ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TAMBAH / EDIT SUBSCRIPTION                        */}
      {/* ======================================================== */}
      {subModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-3.5 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <CreditCard size={16} className="text-primary" /> {editSubId ? 'Edit Langganan' : 'Tambah Langganan'}
              </h3>
              <button onClick={() => setSubModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSub} className="p-3.5 space-y-3 overflow-y-auto flex-1">
              {subFormsData.map((data, index) => (
                <div key={data.id} className={`space-y-2.5 ${index > 0 ? 'pt-3 border-t border-border' : ''}`}>
                  {subFormsData.length > 1 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-text-muted uppercase">Langganan {index + 1}</span>
                      <button type="button" onClick={() => setSubFormsData(subFormsData.filter((_, i) => i !== index))} className="text-danger p-1">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-text-muted mb-0.5 block">Nama Layanan *</label>
                      <input
                        type="text"
                        required
                        value={data.name}
                        onChange={e => {
                          const updated = [...subFormsData];
                          updated[index].name = e.target.value;
                          setSubFormsData(updated);
                        }}
                        placeholder="Netflix, ChatGPT..."
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-text-muted mb-0.5 block">Biaya *</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          required
                          value={data.price}
                          onChange={e => {
                            const updated = [...subFormsData];
                            updated[index].price = e.target.value === '' ? '' : parseFloat(e.target.value);
                            setSubFormsData(updated);
                          }}
                          placeholder="0"
                          className="flex-1 bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-primary"
                        />
                        <select
                          value={data.currency}
                          onChange={e => {
                            const updated = [...subFormsData];
                            updated[index].currency = e.target.value;
                            setSubFormsData(updated);
                          }}
                          className="bg-black/5 dark:bg-black/40 border border-border rounded-lg px-1.5 py-1.5 text-xs text-text-primary"
                        >
                          <option value="IDR">IDR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-text-muted mb-0.5 block">Siklus</label>
                      <select
                        value={data.billingCycle}
                        onChange={e => {
                          const updated = [...subFormsData];
                          updated[index].billingCycle = e.target.value;
                          setSubFormsData(updated);
                        }}
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary"
                      >
                        <option value="monthly">Bulanan</option>
                        <option value="yearly">Tahunan</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-text-muted mb-0.5 block">Jatuh Tempo *</label>
                      <input
                        type="date"
                        required
                        value={data.nextBillingDate}
                        onChange={e => {
                          const updated = [...subFormsData];
                          updated[index].nextBillingDate = e.target.value;
                          setSubFormsData(updated);
                        }}
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary"
                      />
                    </div>
                  </div>

                  {/* Account, URL & Encrypted Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-black/5 dark:bg-black/30 p-2 rounded-lg border border-border/50">
                    <div>
                      <label className="text-[10px] font-semibold text-text-muted mb-0.5 block">Email / Akun</label>
                      <input
                        type="text"
                        value={data.accountEmail}
                        onChange={e => {
                          const updated = [...subFormsData];
                          updated[index].accountEmail = e.target.value;
                          setSubFormsData(updated);
                        }}
                        placeholder="user@example.com"
                        className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-text-muted mb-0.5 block">URL Layanan</label>
                      <input
                        type="text"
                        value={data.url}
                        onChange={e => {
                          const updated = [...subFormsData];
                          updated[index].url = e.target.value;
                          setSubFormsData(updated);
                        }}
                        placeholder="https://netflix.com"
                        className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-text-muted mb-0.5 block flex items-center gap-1">
                        <ShieldCheck size={10} className="text-primary" /> Password (Terenkripsi)
                      </label>
                      <input
                        type="password"
                        value={data.password}
                        onChange={e => {
                          const updated = [...subFormsData];
                          updated[index].password = e.target.value;
                          setSubFormsData(updated);
                        }}
                        placeholder="Disimpan terenkripsi"
                        className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text-primary"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {!editSubId && (
                <button
                  type="button"
                  onClick={() => setSubFormsData([...subFormsData, getEmptySubForm()])}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 pt-1"
                >
                  <Plus size={12} /> Tambah Langganan Lain Sekaligus
                </button>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSubModalOpen(false)}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-semibold text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSub}
                  className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                  {savingSub ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TAMBAH / EDIT BILL PROFILE                        */}
      {/* ======================================================== */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-3.5 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <Bookmark size={16} className="text-primary" /> {editProfile ? 'Edit Profil Tagihan' : 'Tambah Profil Tagihan'}
              </h3>
              <button onClick={() => setProfileModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-3.5 space-y-3">
              <div>
                <label htmlFor="profile-name" className="text-[11px] font-semibold text-text-muted mb-1 block">
                  Nama Tagihan *
                </label>
                <input
                  id="profile-name"
                  type="text"
                  required
                  value={profileFormData.name || ''}
                  onChange={e => setProfileFormData({ ...profileFormData, name: e.target.value })}
                  placeholder="Contoh: Listrik Rumah Utama"
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="profile-category" className="text-[11px] font-semibold text-text-muted mb-1 block">
                  Kategori
                </label>
                <input
                  id="profile-category"
                  type="text"
                  value={profileFormData.category || ''}
                  onChange={e => setProfileFormData({ ...profileFormData, category: e.target.value })}
                  placeholder="Tagihan Bulanan, PLN, Internet, dll"
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="profile-account-number" className="text-[11px] font-semibold text-text-muted mb-1 block">
                  No. Akun / ID Pelanggan *
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="profile-account-number"
                    type="text"
                    required
                    value={profileFormData.accountNumber || ''}
                    onChange={e => setProfileFormData({ ...profileFormData, accountNumber: e.target.value })}
                    placeholder="Contoh: 12 digit ID PLN"
                    className="flex-1 font-mono bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => pasteFromClipboard(val => setProfileFormData({ ...profileFormData, accountNumber: val }))}
                    className="px-2.5 py-1.5 bg-black/5 dark:bg-black/40 border border-border hover:border-primary text-text-muted hover:text-primary rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Clipboard size={12} /> Tempel
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="profile-notes" className="text-[11px] font-semibold text-text-muted mb-1 block">
                  Catatan / Provider
                </label>
                <textarea
                  id="profile-notes"
                  rows={2}
                  value={profileFormData.notes || ''}
                  onChange={e => setProfileFormData({ ...profileFormData, notes: e.target.value })}
                  placeholder="Catatan tambahan (lokasi meteran, nama pelanggan asli, dll)..."
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-semibold text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                  {savingProfile ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
