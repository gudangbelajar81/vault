import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import toast from 'react-hot-toast';
import {
  Users, Plus, X, Trash2, Edit2, ArrowLeft, Wallet, Banknote,
  Calendar, MessageCircle, Printer, Loader2, ChevronDown, Bell, AlertTriangle, CheckCircle2
} from 'lucide-react';

// ============ TYPES ============
interface Employee {
  id: string;
  name: string;
  phone: string | null;
  joinDate: string;
  salaryType: 'Bulanan' | 'Harian';
  baseSalary: number;
  payDate?: number | null; // 1-31
  status: string;
  totalBonAktif?: number;
}

interface CashAdvance {
  id: string;
  employeeId: string;
  date: string;
  amount: number;
  notes: string | null;
  status: string;
}

interface Payroll {
  id: string;
  employeeId: string;
  periodStart: string | null;
  periodEnd: string | null;
  attendanceDays: number;
  basicSalaryCalculated: number;
  totalDeductionBon: number;
  netSalary: number;
  sisaBon: number;
  notes: string | null;
  createdAt: string;
}

interface EmployeeDetail extends Employee {
  cashAdvances: CashAdvance[];
  payrolls: Payroll[];
}

const API = `${API_URL}/api/employees`;

// ============ HELPERS ============
const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

const formatTglIndo = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '-'; }
};

const toISODate = (dateStr?: string | null) => {
  if (!dateStr) return '';
  try { return new Date(dateStr).toISOString().slice(0, 10); } catch { return ''; }
};

const todayISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const plainNumber = (val: string | number) => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  return parseFloat((val || '0').replace(/[^0-9.-]/g, '')) || 0;
};

const formatNumber = (val: string | number) => {
  const n = plainNumber(val);
  if (!n) return '';
  return new Intl.NumberFormat('id-ID').format(n);
};

// ============ MAIN COMPONENT ============
export const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal tambah karyawan baru
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmp, setNewEmp] = useState({
    name: '',
    phone: '',
    joinDate: todayISO(),
    salaryType: 'Harian' as 'Harian' | 'Bulanan',
    baseSalary: '',
    payDate: '',
  });
  const [savingNew, setSavingNew] = useState(false);

  // Modal Struk & Print Thermal
  const [activeStruk, setActiveStruk] = useState<{ payroll: Payroll; employee: EmployeeDetail } | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API, { withCredentials: true });
      if (res.data.success) setEmployees(res.data.data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API}/${id}`, { withCredentials: true });
      if (res.data.success) setDetail(res.data.data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat detail karyawan');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  useEffect(() => {
    if (activeId) fetchDetail(activeId);
    else setDetail(null);
  }, [activeId]);

  // Global Gajian Reminder (H-2, Besok, Hari H)
  const pendingGajian = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const list: { emp: Employee; days: number; text: string }[] = [];

    employees.forEach((e) => {
      if (e.status !== 'Aktif' || !e.payDate) return;
      const payD = Number(e.payDate);
      if (isNaN(payD) || payD < 1 || payD > 31) return;

      let nextPay = new Date(currentYear, currentMonth, payD);
      nextPay.setHours(0, 0, 0, 0);
      if (today.getTime() > nextPay.getTime()) {
        nextPay.setMonth(nextPay.getMonth() + 1);
      }

      const diffTime = nextPay.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / 86400000);

      if (diffDays >= 0 && diffDays <= 2) {
        const text = diffDays === 0 ? 'HARI INI!' : diffDays === 1 ? 'BESOK!' : 'H-2';
        list.push({ emp: e, days: diffDays, text });
      }
    });
    return list;
  }, [employees]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.name.trim()) { toast.error('Nama karyawan wajib diisi'); return; }
    setSavingNew(true);
    try {
      await axios.post(API, {
        name: newEmp.name,
        phone: newEmp.phone,
        joinDate: newEmp.joinDate,
        salaryType: newEmp.salaryType,
        baseSalary: plainNumber(newEmp.baseSalary),
        payDate: newEmp.payDate ? parseInt(newEmp.payDate, 10) : null,
        status: 'Aktif',
      }, { withCredentials: true });
      toast.success('Karyawan baru berhasil ditambahkan');
      setShowAddModal(false);
      setNewEmp({ name: '', phone: '', joinDate: todayISO(), salaryType: 'Harian', baseSalary: '', payDate: '' });
      fetchEmployees();
    } catch (error) {
      toast.error('Gagal menambah karyawan');
    } finally {
      setSavingNew(false);
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus karyawan "${name}"? Semua riwayat kasbon & gaji ikut terhapus.`)) return;
    try {
      await axios.delete(`${API}/${id}`, { withCredentials: true });
      toast.success('Karyawan berhasil dihapus');
      setActiveId(null);
      fetchEmployees();
    } catch (error) {
      toast.error('Gagal menghapus karyawan');
    }
  };

  const handlePrintThermal = () => {
    window.print();
  };

  const sendStrukWA = (p: Payroll, emp: EmployeeDetail) => {
    if (!emp.phone) {
      toast.error('Nomor HP karyawan belum diisi di profil!');
      return;
    }
    let phone = emp.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

    const text = `==============================
   STRUK GAJI KARYAWAN
   VAULTPRO ENTERPRISE
==============================
Nama    : ${emp.name.toUpperCase()}
Periode : ${(!p.periodStart && !p.periodEnd) ? '-' : `${formatTglIndo(p.periodStart)} s/d ${formatTglIndo(p.periodEnd)}`}
${p.attendanceDays > 0 ? `Hari Kerja : ${p.attendanceDays} Hari\n` : ''}------------------------------
TOTAL GAJI      : ${rupiah(p.basicSalaryCalculated)}
Potong Kasbon   : ${p.totalDeductionBon > 0 ? rupiah(p.totalDeductionBon) : 'Rp 0'}
Sisa Bon Depan  : ${p.sisaBon > 0 ? rupiah(p.sisaBon) : 'Rp 0'}
------------------------------
GAJI DITERIMA   : ${rupiah(p.netSalary)}
==============================
Catatan: ${p.notes || '-'}`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (activeId) {
    return (
      <>
        <EmployeeDashboard
          detail={detail}
          loading={detailLoading}
          onBack={() => setActiveId(null)}
          onDeleted={() => { setActiveId(null); fetchEmployees(); }}
          onRefresh={() => { fetchDetail(activeId); fetchEmployees(); }}
          onOpenStruk={(p, emp) => setActiveStruk({ payroll: p, employee: emp })}
        />
        {activeStruk && (
          <StrukModal
            data={activeStruk}
            onClose={() => setActiveStruk(null)}
            onPrint={handlePrintThermal}
            onSendWA={() => sendStrukWA(activeStruk.payroll, activeStruk.employee)}
          />
        )}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col relative max-w-5xl mx-auto w-full p-3 md:p-0">
      {/* Gajian Global Reminder Banner */}
      {pendingGajian.length > 0 && (
        <div className="mb-4 bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-700 text-white rounded-xl p-3 md:p-4 shadow-xl border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 text-xl font-bold">
              🔔
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm md:text-base tracking-wide uppercase">WAKTUNYA GAJIAN BOS!</h4>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black uppercase">Jadwal</span>
              </div>
              <div className="text-xs text-white/90 mt-0.5 flex flex-wrap gap-2">
                {pendingGajian.map((item) => (
                  <span
                    key={item.emp.id}
                    onClick={() => setActiveId(item.emp.id)}
                    className="inline-flex items-center gap-1.5 bg-black/20 hover:bg-black/40 px-2 py-1 rounded-md cursor-pointer transition-colors border border-white/10"
                  >
                    <strong>{item.emp.name}</strong> ({item.text})
                    {(item.emp.totalBonAktif || 0) > 0 && (
                      <span className="text-amber-300 font-bold">⚠️ Ada Bon: {rupiah(item.emp.totalBonAktif || 0)}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-white/70 self-end sm:self-center">
            Klik nama karyawan untuk proses gaji
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 md:mb-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-text-primary leading-tight">Data Karyawan & Gaji</h2>
            <p className="text-[10px] md:text-xs text-text-muted leading-tight">Kelola profil, kasbon/bon, dan penggajian karyawan</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg text-xs md:text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-1.5 transition-all active:scale-95"
        >
          <Plus size={14} /> <span className="hidden sm:inline">Karyawan Baru</span><span className="sm:hidden">Baru</span>
        </button>
      </div>

      {/* Table List */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-surface/30 border border-border rounded-xl md:rounded-2xl p-2 md:p-4 backdrop-blur-sm shadow-inner">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-text-muted gap-2">
            <Loader2 size={16} className="animate-spin" /> Memuat data karyawan...
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm py-10">
            <Users size={40} className="mb-3 opacity-30" />
            <p>Belum ada data karyawan.</p>
            <button onClick={() => setShowAddModal(true)} className="mt-3 text-primary font-semibold text-xs hover:underline">
              + Tambah karyawan pertama
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {employees.map((e) => (
              <div
                key={e.id}
                onClick={() => setActiveId(e.id)}
                className="bg-surface border border-border hover:border-primary/50 rounded-xl p-3 md:p-4 flex items-center justify-between gap-3 transition-all shadow-sm cursor-pointer group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-sm">
                    {e.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-text-primary text-sm truncate group-hover:text-primary transition-colors">{e.name}</h4>
                      {e.payDate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                          Gajian Tgl {e.payDate}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 font-semibold">{e.salaryType}</span>
                      {(e.baseSalary || 0) > 0 ? (
                        <span className="font-semibold text-emerald-400">
                          {rupiah(e.baseSalary)}{e.salaryType === 'Harian' ? '/hari' : '/bln'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                          <AlertTriangle size={10} /> Gaji belum diatur
                        </span>
                      )}
                      {e.phone && <span className="hidden sm:inline">· {e.phone}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {(e.totalBonAktif || 0) > 0 && (
                    <div className="text-right">
                      <div className="text-[10px] text-text-muted">Kasbon Aktif</div>
                      <div className="text-xs md:text-sm font-bold text-danger">{rupiah(e.totalBonAktif || 0)}</div>
                    </div>
                  )}
                  <button
                    onClick={(ev) => { ev.stopPropagation(); handleDeleteEmployee(e.id, e.name); }}
                    className="p-1.5 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                    title="Hapus Karyawan"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Tambah Karyawan */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="bg-surface border border-border w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-border bg-black/5 shrink-0">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Plus size={16} className="text-primary" /> Tambah Karyawan Baru
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-text-primary p-1"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddEmployee} className="p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
              <div>
                <label htmlFor="add-emp-name" className="text-[11px] font-semibold text-text-muted mb-1 block">Nama Karyawan *</label>
                <input
                  id="add-emp-name"
                  type="text" required autoFocus
                  value={newEmp.name}
                  onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                  placeholder="Contoh: Siti"
                  className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label htmlFor="add-emp-phone" className="text-[11px] font-semibold text-text-muted mb-1 block">No HP WhatsApp</label>
                <input
                  id="add-emp-phone"
                  type="tel" inputMode="tel"
                  value={newEmp.phone}
                  onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                  placeholder="Contoh: 08123456789"
                  className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="add-emp-join" className="text-[11px] font-semibold text-text-muted mb-1 block">Tgl Masuk / Mulai Hitung *</label>
                  <input
                    id="add-emp-join"
                    type="date" required
                    value={newEmp.joinDate}
                    onChange={(e) => setNewEmp({ ...newEmp, joinDate: e.target.value })}
                    className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="add-emp-paydate" className="text-[11px] font-semibold text-text-muted mb-1 block">Tgl Gajian Bulanan (1-31)</label>
                  <input
                    id="add-emp-paydate"
                    type="number" inputMode="numeric" min={1} max={31}
                    value={newEmp.payDate}
                    onChange={(e) => setNewEmp({ ...newEmp, payDate: e.target.value })}
                    placeholder="Contoh: 25"
                    className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
              <div>
                <span id="add-emp-salary-type-label" className="text-[11px] font-semibold text-text-muted mb-1 block">Skema Gaji *</span>
                <div role="group" aria-labelledby="add-emp-salary-type-label" className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewEmp({ ...newEmp, salaryType: 'Harian' })}
                    className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      newEmp.salaryType === 'Harian'
                        ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                        : 'bg-black/5 dark:bg-black/40 text-text-muted border-border hover:text-text-primary'
                    }`}
                  >
                    Harian (Per Hari)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEmp({ ...newEmp, salaryType: 'Bulanan' })}
                    className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      newEmp.salaryType === 'Bulanan'
                        ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                        : 'bg-black/5 dark:bg-black/40 text-text-muted border-border hover:text-text-primary'
                    }`}
                  >
                    Bulanan (Per Bulan)
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="add-emp-salary" className="text-[11px] font-semibold text-text-muted mb-1 block">
                  {newEmp.salaryType === 'Harian' ? 'Upah per Hari (Rp) *' : 'Gaji per Bulan (Rp) *'}
                </label>
                <input
                  id="add-emp-salary"
                  type="text" inputMode="numeric" required
                  value={formatNumber(newEmp.baseSalary)}
                  onChange={(e) => setNewEmp({ ...newEmp, baseSalary: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder={newEmp.salaryType === 'Harian' ? 'Contoh: 100.000' : 'Contoh: 2.500.000'}
                  className="w-full min-h-[44px] bg-white dark:bg-black/60 border border-border rounded-lg px-3 py-2 text-sm font-bold text-text-primary outline-none focus:border-primary transition-colors"
                />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px] text-text-muted">
                  <span>
                    {plainNumber(newEmp.baseSalary) > 0
                      ? newEmp.salaryType === 'Harian'
                        ? `Estimasi 30 hari: ${rupiah(plainNumber(newEmp.baseSalary) * 30)}/bln`
                        : `Setara ± ${rupiah(Math.round(plainNumber(newEmp.baseSalary) / 30))}/hari`
                      : newEmp.salaryType === 'Harian'
                        ? 'Nominal dibayar per hari kerja aktif'
                        : 'Nominal dibayar tetap per bulan'}
                  </span>
                  {newEmp.salaryType === 'Harian' && plainNumber(newEmp.baseSalary) >= 300000 && (
                    <button
                      type="button"
                      onClick={() => setNewEmp({ ...newEmp, baseSalary: String(Math.round(plainNumber(newEmp.baseSalary) / 30)) })}
                      className="text-amber-400 hover:underline font-semibold"
                    >
                      Bagi 30 ({rupiah(Math.round(plainNumber(newEmp.baseSalary) / 30))}/hari)
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-border">
                <button type="button" onClick={() => setShowAddModal(false)} className="min-h-[44px] px-4 py-2 rounded-lg text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm font-bold">
                  Batal
                </button>
                <button type="submit" disabled={savingNew} className="min-h-[44px] bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg transition-transform active:scale-95 text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center min-w-[100px]">
                  {savingNew ? <Loader2 size={16} className="animate-spin" /> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ EMPLOYEE DASHBOARD (DETAIL VIEW) ============
// SEMUA HOOKS DILETAKKAN DI PALING ATAS UNTUK MENCEGAH REACT HOOK ORDER ERROR
const EmployeeDashboard: React.FC<{
  detail: EmployeeDetail | null;
  loading: boolean;
  onBack: () => void;
  onDeleted: () => void;
  onRefresh: () => void;
  onOpenStruk: (p: Payroll, emp: EmployeeDetail) => void;
}> = ({ detail, loading, onBack, onDeleted, onRefresh, onOpenStruk }) => {
  // 1. All useState at top
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    joinDate: '',
    salaryType: 'Harian' as 'Harian' | 'Bulanan',
    baseSalary: '',
    payDate: '',
    status: 'Aktif',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [showBonForm, setShowBonForm] = useState(false);
  const [bonForm, setBonForm] = useState({ id: '', date: todayISO(), amount: '', notes: '' });
  const [savingBon, setSavingBon] = useState(false);

  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [leaveDays, setLeaveDays] = useState('0');
  const [cicilKasbon, setCicilKasbon] = useState('');
  const [payrollNotes, setPayrollNotes] = useState('');
  const [resetJoinDate, setResetJoinDate] = useState(true);
  const [processingPayroll, setProcessingPayroll] = useState(false);

  const prevEmpIdRef = useRef<string | null>(null);
  const prevJoinDateRef = useRef<string>('');
  const hasEditedCicilanRef = useRef(false);
  const profileCardRef = useRef<HTMLDivElement | null>(null);
  const salaryInputRef = useRef<HTMLInputElement | null>(null);

  // 2. All useEffect at top
  useEffect(() => {
    if (!detail) {
      prevEmpIdRef.current = null;
      prevJoinDateRef.current = '';
      return;
    }

    const normalizedJoin = toISODate(detail.joinDate);
    const isNewEmp = prevEmpIdRef.current !== detail.id;
    const isJoinChanged = prevJoinDateRef.current !== normalizedJoin;

    setProfileForm({
      name: detail.name,
      phone: detail.phone || '',
      joinDate: normalizedJoin,
      salaryType: detail.salaryType,
      baseSalary: detail.baseSalary > 0 ? String(detail.baseSalary) : '',
      payDate: detail.payDate ? String(detail.payDate) : '',
      status: detail.status,
    });

    if (isNewEmp) {
      setEditProfile((detail.baseSalary || 0) <= 0);
      setLeaveDays('0');
      setCicilKasbon('');
      setPayrollNotes('');
      setShowBonForm(false);
      hasEditedCicilanRef.current = false;
    }

    if (isNewEmp || isJoinChanged) {
      setPeriodStart(normalizedJoin);
      setPeriodEnd(todayISO());
    }

    prevEmpIdRef.current = detail.id;
    prevJoinDateRef.current = normalizedJoin;
  }, [detail]);

  const unpaidBons = detail ? detail.cashAdvances.filter((c) => c.status === 'Belum Lunas') : [];
  const totalBon = unpaidBons.reduce((sum, c) => sum + c.amount, 0);

  // Hitung gaji realtime
  let actualDays = 0;
  let isPeriodInvalid = false;
  if (periodStart && periodEnd) {
    const d1 = new Date(periodStart);
    const d2 = new Date(periodEnd);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      if (d2.getTime() < d1.getTime()) {
        isPeriodInvalid = true;
        actualDays = 0;
      } else if (profileForm.salaryType === 'Harian') {
        const diffDays = Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1;
        actualDays = Math.max(0, diffDays - (Number(leaveDays) || 0));
      }
    }
  }

  const baseSalaryNum = plainNumber(profileForm.baseSalary);
  let basicCalc = 0;
  let breakdownText = '';
  if (profileForm.salaryType === 'Harian') {
    const dailyRate = baseSalaryNum;
    basicCalc = dailyRate * actualDays;
    breakdownText = `${rupiah(dailyRate)}/hari × ${actualDays} hari`;
  } else {
    basicCalc = baseSalaryNum;
    breakdownText = `Gaji 1 Bulan Penuh (${rupiah(baseSalaryNum)}/bln)`;
  }

  const cicil = Math.min(plainNumber(cicilKasbon), totalBon);
  const net = basicCalc - cicil;
  const sisaBonBaru = Math.max(0, totalBon - cicil);

  const isProfileDirty = detail ? (
    profileForm.name.trim() !== detail.name.trim() ||
    (profileForm.phone || '').trim() !== (detail.phone || '').trim() ||
    profileForm.joinDate !== toISODate(detail.joinDate) ||
    profileForm.salaryType !== detail.salaryType ||
    baseSalaryNum !== (detail.baseSalary || 0) ||
    (profileForm.payDate ? parseInt(profileForm.payDate, 10) : null) !== (detail.payDate ?? null) ||
    profileForm.status !== detail.status
  ) : false;

  // Auto-fill cicilan default (tanpa menimpa edit manual user)
  useEffect(() => {
    if (hasEditedCicilanRef.current) return;
    if (totalBon > 0) {
      const autoDeduction = basicCalc > 0 ? Math.min(totalBon, basicCalc) : 0;
      setCicilKasbon(autoDeduction > 0 ? String(autoDeduction) : '');
    } else {
      setCicilKasbon('');
    }
  }, [totalBon, basicCalc]);

  // Early return setelah seluruh hooks dideklarasikan
  if (loading || !detail) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted gap-2 text-sm">
        <Loader2 size={18} className="animate-spin" /> Memuat dashboard karyawan...
      </div>
    );
  }

  const focusSalaryInput = () => {
    setEditProfile(true);
    setTimeout(() => {
      profileCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      salaryInputRef.current?.focus();
    }, 60);
  };

  const saveProfileData = async () => {
    if (!profileForm.name.trim()) {
      toast.error('Nama karyawan wajib diisi');
      return false;
    }
    setSavingProfile(true);
    try {
      await axios.put(`${API}/${detail.id}`, {
        name: profileForm.name,
        phone: profileForm.phone,
        joinDate: profileForm.joinDate,
        salaryType: profileForm.salaryType,
        baseSalary: plainNumber(profileForm.baseSalary),
        payDate: profileForm.payDate ? parseInt(profileForm.payDate, 10) : null,
        status: profileForm.status,
      }, { withCredentials: true });
      toast.success('Profil & nominal gaji berhasil disimpan');
      if (plainNumber(profileForm.baseSalary) > 0) {
        setEditProfile(false);
      }
      onRefresh();
      return true;
    } catch (error) {
      toast.error('Gagal mengupdate profil');
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfileData();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Yakin ingin menghapus karyawan "${detail.name}"?`)) return;
    try {
      await axios.delete(`${API}/${detail.id}`, { withCredentials: true });
      toast.success('Karyawan berhasil dihapus');
      onDeleted();
    } catch (error) {
      toast.error('Gagal menghapus karyawan');
    }
  };

  const openAddBon = () => {
    setBonForm({ id: '', date: todayISO(), amount: '', notes: '' });
    setShowBonForm(true);
  };

  const openEditBon = (bon: CashAdvance) => {
    setBonForm({ id: bon.id, date: toISODate(bon.date), amount: String(bon.amount), notes: bon.notes || '' });
    setShowBonForm(true);
  };

  const handleSaveBon = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBon(true);
    try {
      if (bonForm.id) {
        await axios.put(`${API}/cash-advances/${bonForm.id}`, {
          date: bonForm.date,
          amount: plainNumber(bonForm.amount),
          notes: bonForm.notes,
        }, { withCredentials: true });
      } else {
        await axios.post(`${API}/${detail.id}/cash-advances`, {
          date: bonForm.date,
          amount: plainNumber(bonForm.amount),
          notes: bonForm.notes,
        }, { withCredentials: true });
      }
      toast.success('Kasbon berhasil disimpan');
      setShowBonForm(false);
      onRefresh();
    } catch (error) {
      toast.error('Gagal menyimpan kasbon');
    } finally {
      setSavingBon(false);
    }
  };

  const handleDeleteBon = async (id: string) => {
    if (!window.confirm('Hapus kasbon ini?')) return;
    try {
      await axios.delete(`${API}/cash-advances/${id}`, { withCredentials: true });
      toast.success('Kasbon berhasil dihapus');
      onRefresh();
    } catch (error) {
      toast.error('Gagal menghapus kasbon');
    }
  };

  const handleProcessPayroll = async () => {
    if (isPeriodInvalid) {
      toast.error('Tanggal periode akhir tidak boleh sebelum tanggal mulai');
      return;
    }
    if (basicCalc <= 0) {
      toast.error('Atur nominal gaji terlebih dahulu sebelum mencairkan gaji');
      focusSalaryInput();
      return;
    }
    if (net < 0) {
      toast.error('Potongan kasbon tidak boleh melebihi total gaji!');
      return;
    }

    const dirtyWarning = isProfileDirty
      ? '\n\nPerhatian: Perubahan profil/gaji di form belum disimpan ke database. Pencairan tetap memakai draf saat ini.'
      : '';
    if (!window.confirm(`Yakin bayar gaji ${detail.name} sejumlah ${rupiah(net)}?\nPotong Kasbon: ${rupiah(cicil)}${dirtyWarning}`)) return;

    setProcessingPayroll(true);
    try {
      await axios.post(`${API}/${detail.id}/payrolls`, {
        periodStart,
        periodEnd,
        attendanceDays: profileForm.salaryType === 'Harian' ? actualDays : 0,
        basicSalaryCalculated: basicCalc,
        cicilKasbon: cicil,
        notes: payrollNotes,
        resetJoinDate,
      }, { withCredentials: true });
      toast.success('Gaji berhasil dibayarkan!');
      setCicilKasbon('');
      setPayrollNotes('');
      hasEditedCicilanRef.current = false;
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal memproses penggajian');
    } finally {
      setProcessingPayroll(false);
    }
  };

  const handleDeletePayroll = async (id: string) => {
    if (!window.confirm('Hapus riwayat gaji ini?')) return;
    try {
      await axios.delete(`${API}/payrolls/${id}`, { withCredentials: true });
      toast.success('Riwayat gaji berhasil dihapus');
      onRefresh();
    } catch (error) {
      toast.error('Gagal menghapus riwayat gaji');
    }
  };

  const sendWaPersetujuan = () => {
    if (!detail.phone) {
      toast.error('Nomor HP karyawan belum diisi di profil!');
      return;
    }
    const rincianKasbon = unpaidBons.length > 0
      ? unpaidBons.map((b, i) => `${i + 1}. ${formatTglIndo(b.date)} ${b.notes ? '(' + b.notes + ')' : ''} : ${rupiah(b.amount)}`).join('\n')
      : '- Tidak ada kasbon';

    const msg = `================================
STRUK RINCIAN GAJI & BON
VAULTPRO ENTERPRISE
================================
NAMA     : *${detail.name.toUpperCase()}*
PERIODE  : ${formatTglIndo(periodStart)} s/d ${formatTglIndo(periodEnd)}

--------------------------------
[ RINCIAN KASBON BELUM LUNAS ]
--------------------------------
${rincianKasbon}
--
Total Kasbon (Utang) : *${rupiah(totalBon)}*
--------------------------------

[ RINCIAN GAJI ]
Total Gaji (${profileForm.salaryType}) : *${rupiah(basicCalc)}*
================================

Berdasarkan rincian di atas, untuk gajian periode ini kasbonnya mau *Dipotong Full (Lunas)* atau mau *Dicicil Sebagian* dulu?`;

    let phone = detail.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-3 md:p-0 max-w-5xl mx-auto w-full">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary mb-3 transition-colors min-h-[36px]">
        <ArrowLeft size={14} /> Kembali ke Daftar Karyawan
      </button>

      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg md:text-xl font-black text-text-primary">Dashboard: {detail.name}</h2>
          {baseSalaryNum > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              <CheckCircle2 size={12} /> {profileForm.salaryType} · {rupiah(baseSalaryNum)}{profileForm.salaryType === 'Harian' ? '/hari' : '/bln'}
            </span>
          ) : (
            <button
              type="button"
              onClick={focusSalaryInput}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold hover:bg-amber-500/20 transition-colors"
            >
              <AlertTriangle size={12} /> Gaji Belum Diatur (Rp 0) · Atur Sekarang
            </button>
          )}
          {detail.payDate && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
              Jadwal Gajian Tgl {detail.payDate}
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5">Kelola profil, nominal gaji, riwayat kasbon, dan proses penggajian</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ===== KOLOM KIRI: Profil & Kasbon ===== */}
        <div className="flex flex-col gap-4">
          {/* Profil Karyawan */}
          <div ref={profileCardRef} className="bg-surface border border-border rounded-xl p-3 md:p-4">
            <button
              type="button"
              aria-expanded={editProfile}
              onClick={() => setEditProfile(!editProfile)}
              className="w-full flex items-center justify-between gap-2 text-left"
            >
              <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
                <Users size={15} className="text-emerald-400" /> Profil & Skema Gaji
              </h3>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary">
                {editProfile ? 'Tutup' : baseSalaryNum <= 0 ? 'Atur Gaji' : 'Edit Profil / Gaji'}
                <ChevronDown size={16} className={`text-text-muted transition-transform ${editProfile ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {!editProfile && (
              <div className="mt-2.5 pt-2.5 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-text-primary font-semibold">
                    {profileForm.salaryType}
                  </span>
                  {baseSalaryNum > 0 ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold">
                      {rupiah(baseSalaryNum)}{profileForm.salaryType === 'Harian' ? '/hari' : '/bln'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-bold">
                      Gaji belum diatur (Rp 0)
                    </span>
                  )}
                  {profileForm.payDate && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 font-semibold">
                      Gajian Tgl {profileForm.payDate}
                    </span>
                  )}
                  {profileForm.joinDate && (
                    <span className="text-text-muted">
                      Masuk {formatTglIndo(profileForm.joinDate)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={focusSalaryInput}
                  className="text-xs font-bold text-primary hover:underline px-2 py-1"
                >
                  {baseSalaryNum <= 0 ? 'Atur Gaji Sekarang' : 'Edit Profil / Gaji'}
                </button>
              </div>
            )}

            {editProfile && (
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 mt-3 pt-3 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="emp-name" className="text-[11px] font-semibold text-text-muted mb-1 block">Nama Karyawan *</label>
                    <input
                      id="emp-name"
                      type="text"
                      required
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="Nama karyawan"
                      className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-phone" className="text-[11px] font-semibold text-text-muted mb-1 block">No HP WhatsApp</label>
                    <input
                      id="emp-phone"
                      type="tel"
                      inputMode="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="Contoh: 08123456789"
                      className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <span id="emp-salary-type-label" className="text-[11px] font-semibold text-text-muted mb-1 block">Skema Gaji *</span>
                  <div role="group" aria-labelledby="emp-salary-type-label" className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileForm({ ...profileForm, salaryType: 'Harian' })}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                        profileForm.salaryType === 'Harian'
                          ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                          : 'bg-black/5 dark:bg-black/40 text-text-muted border-border hover:text-text-primary'
                      }`}
                    >
                      Harian (Per Hari)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileForm({ ...profileForm, salaryType: 'Bulanan' })}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                        profileForm.salaryType === 'Bulanan'
                          ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                          : 'bg-black/5 dark:bg-black/40 text-text-muted border-border hover:text-text-primary'
                      }`}
                    >
                      Bulanan (Per Bulan)
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="emp-salary" className="text-[11px] font-semibold text-text-muted mb-1 block">
                    {profileForm.salaryType === 'Harian' ? 'Upah per Hari (Rp) *' : 'Gaji per Bulan (Rp) *'}
                  </label>
                  <input
                    ref={salaryInputRef}
                    id="emp-salary"
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatNumber(profileForm.baseSalary)}
                    onChange={(e) => setProfileForm({ ...profileForm, baseSalary: e.target.value.replace(/[^0-9]/g, '') })}
                    placeholder={profileForm.salaryType === 'Harian' ? 'Contoh: 100.000' : 'Contoh: 2.500.000'}
                    className="w-full min-h-[44px] bg-white dark:bg-black/60 border border-border rounded-lg px-3 py-2 text-sm font-bold text-text-primary outline-none focus:border-primary"
                  />
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px] text-text-muted">
                    <span>
                      {baseSalaryNum > 0
                        ? profileForm.salaryType === 'Harian'
                          ? `Estimasi 30 hari: ${rupiah(baseSalaryNum * 30)}/bln`
                          : `Setara ± ${rupiah(Math.round(baseSalaryNum / 30))}/hari`
                        : profileForm.salaryType === 'Harian'
                          ? 'Nominal dibayar per hari kerja aktif'
                          : 'Nominal dibayar tetap per bulan'}
                    </span>
                    {profileForm.salaryType === 'Harian' && baseSalaryNum >= 300000 && (
                      <button
                        type="button"
                        onClick={() => setProfileForm({ ...profileForm, baseSalary: String(Math.round(baseSalaryNum / 30)) })}
                        className="text-amber-400 hover:underline font-semibold"
                      >
                        Bagi 30 ({rupiah(Math.round(baseSalaryNum / 30))}/hari)
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label htmlFor="emp-join" className="text-[11px] font-semibold text-text-muted mb-1 block">Tgl Mulai Hitung *</label>
                    <input
                      id="emp-join"
                      type="date"
                      required
                      value={profileForm.joinDate}
                      onChange={(e) => setProfileForm({ ...profileForm, joinDate: e.target.value })}
                      className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-paydate" className="text-[11px] font-semibold text-text-muted mb-1 block">Tgl Gajian (1-31)</label>
                    <input
                      id="emp-paydate"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      value={profileForm.payDate}
                      onChange={(e) => setProfileForm({ ...profileForm, payDate: e.target.value })}
                      placeholder="Tgl (1-31)"
                      title="Tanggal Gajian Bulanan"
                      className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="emp-status" className="text-[11px] font-semibold text-text-muted mb-1 block">Status</label>
                    <select
                      id="emp-status"
                      value={profileForm.status}
                      onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value })}
                      className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-primary"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Nonaktif">Nonaktif</option>
                      <option value="Cuti">Cuti</option>
                    </select>
                  </div>
                </div>

                {isProfileDirty && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-400">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>Ada perubahan profil/gaji yang belum disimpan ke database.</span>
                  </div>
                )}

                <div className="flex gap-2 mt-1">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex-1 min-h-[44px] bg-primary hover:bg-primary/90 disabled:opacity-60 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    {savingProfile ? <Loader2 size={14} className="animate-spin" /> : 'Simpan Profil & Gaji'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="min-h-[44px] bg-danger/10 hover:bg-danger/20 text-danger px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Trash2 size={14} /> Hapus
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Riwayat Kasbon */}
          <div className="bg-surface border border-border rounded-xl p-3 md:p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
                <Banknote size={15} className="text-amber-400" /> Riwayat Kasbon
              </h3>
              <button onClick={openAddBon} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                <Plus size={12} /> Kasbon Baru
              </button>
            </div>

            {showBonForm && (
              <form onSubmit={handleSaveBon} className="flex flex-col gap-2 bg-black/5 dark:bg-black/20 rounded-lg p-2.5 mb-3 border border-border">
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" required value={bonForm.date} onChange={(e) => setBonForm({ ...bonForm, date: e.target.value })} className="bg-white dark:bg-black/60 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary" />
                  <input type="text" inputMode="numeric" required value={formatNumber(bonForm.amount)} onChange={(e) => setBonForm({ ...bonForm, amount: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Nominal" className="bg-white dark:bg-black/60 border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-danger outline-none focus:border-primary" />
                </div>
                <input type="text" value={bonForm.notes} onChange={(e) => setBonForm({ ...bonForm, notes: e.target.value })} placeholder="Keterangan (opsional)" className="bg-white dark:bg-black/60 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary" />
                <div className="flex gap-2">
                  <button type="submit" disabled={savingBon} className="flex-1 bg-primary hover:bg-primary/90 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
                    {savingBon ? <Loader2 size={12} className="animate-spin" /> : 'Simpan'}
                  </button>
                  <button type="button" onClick={() => setShowBonForm(false)} className="px-3 py-1.5 rounded-lg text-xs text-text-muted hover:bg-black/5 dark:hover:bg-white/5">
                    Batal
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-col gap-1.5">
              {unpaidBons.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-3">Tidak ada utang kasbon aktif</p>
              ) : unpaidBons.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 bg-black/5 dark:bg-white/5 rounded-lg px-2.5 py-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-danger">{rupiah(c.amount)}</div>
                    <div className="text-[10px] text-text-muted truncate">{formatTglIndo(c.date)}{c.notes ? ` · ${c.notes}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditBon(c)} className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-muted hover:text-primary"><Edit2 size={12} /></button>
                    <button onClick={() => handleDeleteBon(c.id)} className="p-1.5 rounded hover:bg-danger/10 text-text-muted hover:text-danger"><X size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border/60 text-right text-xs font-bold text-text-primary">
              Total Kasbon Aktif: <span className="text-danger">{rupiah(totalBon)}</span>
            </div>
          </div>
        </div>

        {/* ===== KOLOM KANAN: Hitung Gaji & Riwayat ===== */}
        <div className="flex flex-col gap-4">
          <div className="bg-surface border border-primary/40 rounded-xl p-3 md:p-4 bg-primary/5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
                <Wallet size={15} className="text-primary" /> Hitung & Bayar Gaji
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                {profileForm.salaryType} · {baseSalaryNum > 0 ? `${rupiah(baseSalaryNum)}${profileForm.salaryType === 'Harian' ? '/hari' : '/bln'}` : 'Rp 0'}
              </span>
            </div>

            {baseSalaryNum <= 0 && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle size={14} className="shrink-0" />
                  Nominal gaji masih Rp 0. Isi di Profil & Skema Gaji agar bisa dihitung.
                </span>
                <button type="button" onClick={focusSalaryInput} className="font-bold underline shrink-0">
                  Atur Nominal Gaji
                </button>
              </div>
            )}

            {isProfileDirty && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle size={14} className="shrink-0" />
                  Kalkulator memakai perubahan draf di Profil yang belum disimpan.
                </span>
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={saveProfileData}
                  className="font-bold underline shrink-0 disabled:opacity-60"
                >
                  {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
              <div>
                <label htmlFor="payroll-period-start" className="text-[10px] text-text-muted block mb-1">Periode Mulai</label>
                <input
                  id="payroll-period-start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="payroll-period-end" className="text-[10px] text-text-muted block mb-1">Periode Akhir</label>
                <input
                  id="payroll-period-end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className={`w-full min-h-[44px] bg-black/5 dark:bg-black/40 border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary ${isPeriodInvalid ? 'border-danger' : 'border-border'}`}
                />
              </div>
              {profileForm.salaryType === 'Harian' && (
                <>
                  <div>
                    <label htmlFor="payroll-leave-days" className="text-[10px] text-text-muted block mb-1">Potong Libur / Izin (Hari)</label>
                    <input
                      id="payroll-leave-days"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={leaveDays}
                      onChange={(e) => setLeaveDays(e.target.value)}
                      className="w-full min-h-[44px] bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="payroll-actual-days" className="text-[10px] text-text-muted block mb-1">Hari Kerja Aktual</label>
                    <input
                      id="payroll-actual-days"
                      type="text"
                      readOnly
                      value={`${actualDays} Hari`}
                      className="w-full min-h-[44px] bg-black/10 dark:bg-black/60 border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-primary text-right"
                    />
                  </div>
                </>
              )}
            </div>

            {isPeriodInvalid && (
              <div className="mb-3 flex items-center gap-1.5 text-[11px] text-danger font-semibold">
                <AlertTriangle size={13} className="shrink-0" />
                <span>Tanggal Periode Akhir tidak boleh sebelum Tanggal Mulai.</span>
              </div>
            )}

            <div className="bg-black/5 dark:bg-black/30 rounded-lg p-3 font-mono text-xs">
              <div className="text-center font-bold border-b border-dashed border-border pb-1.5 mb-2">RINCIAN GAJI</div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-semibold">TOTAL GAJI</span>
                <strong>{rupiah(basicCalc)}</strong>
              </div>
              <div className="text-[10px] text-text-muted mb-1.5 opacity-70">({breakdownText})</div>

              {totalBon > 0 && (
                <div className="mb-1.5">
                  <div className="flex justify-between items-center gap-2">
                    <label htmlFor="payroll-cicil-bon" className="text-danger font-semibold shrink-0">Potong Kasbon:</label>
                    <div className="text-right flex-1">
                      <input
                        id="payroll-cicil-bon"
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(cicilKasbon)}
                        onChange={(e) => {
                          hasEditedCicilanRef.current = true;
                          setCicilKasbon(e.target.value.replace(/[^0-9]/g, ''));
                        }}
                        placeholder="0"
                        className="w-full text-right text-danger font-bold bg-transparent border-b border-danger outline-none py-1"
                      />
                      <div className="text-[10px] opacity-70 mt-0.5">Total Utang: {rupiah(totalBon)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        hasEditedCicilanRef.current = true;
                        setCicilKasbon(String(Math.min(totalBon, basicCalc)));
                      }}
                      className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 hover:bg-primary/20 text-[10px] font-sans font-semibold text-text-primary"
                    >
                      Otomatis
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        hasEditedCicilanRef.current = true;
                        setCicilKasbon(String(totalBon));
                      }}
                      className="px-2 py-0.5 rounded bg-danger/10 hover:bg-danger/20 text-[10px] font-sans font-semibold text-danger"
                    >
                      Lunaskan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        hasEditedCicilanRef.current = true;
                        setCicilKasbon('0');
                      }}
                      className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-[10px] font-sans font-semibold text-text-muted"
                    >
                      Nol
                    </button>
                  </div>
                </div>
              )}

              <hr className="border-border my-2" />
              <div className="flex justify-between text-sm font-bold">
                <span>Gaji Bersih Diterima:</span>
                <strong className={net < 0 ? 'text-danger' : 'text-emerald-400'}>{rupiah(net)}</strong>
              </div>
              {net < 0 && (
                <div className="text-[10px] text-danger font-sans font-semibold mt-1">
                  Potongan kasbon melebihi total gaji. Sesuaikan nominal potongan.
                </div>
              )}
              {totalBon > 0 && (
                <div className="flex justify-between text-xs mt-1.5">
                  <span>Sisa Bon Bulan Depan:</span>
                  <strong className="text-amber-400">{rupiah(sisaBonBaru)}</strong>
                </div>
              )}
            </div>

            <input
              type="text"
              value={payrollNotes}
              onChange={(e) => setPayrollNotes(e.target.value)}
              placeholder="Keterangan gaji (opsional)"
              className="w-full min-h-[44px] mt-3 bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-primary"
            />

            <label className="flex items-center gap-2 mt-2 text-[11px] text-text-muted cursor-pointer">
              <input type="checkbox" checked={resetJoinDate} onChange={(e) => setResetJoinDate(e.target.checked)} />
              Set "Tanggal Masuk" ke besok (centang jika lanjut kerja)
            </label>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={sendWaPersetujuan}
                className="flex-1 min-h-[44px] bg-surface border border-border hover:bg-black/5 dark:hover:bg-white/5 text-text-primary py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={14} /> Kirim Rincian WA
              </button>
              <button
                type="button"
                onClick={handleProcessPayroll}
                disabled={processingPayroll || basicCalc <= 0 || isPeriodInvalid || net < 0}
                className="flex-1 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                {processingPayroll ? <Loader2 size={14} className="animate-spin" /> : 'Cairkan Gaji'}
              </button>
            </div>
          </div>

          {/* Riwayat Gaji (Bulan ke Bulan) */}
          <div className="bg-surface border border-border rounded-xl p-3 md:p-4">
            <h3 className="font-bold text-sm text-text-primary mb-2">Riwayat Gaji (Bulan ke Bulan)</h3>
            {detail.payrolls.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-3">Belum ada riwayat penggajian.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {detail.payrolls.map((p) => {
                  const tglStr = (!p.periodStart && !p.periodEnd)
                    ? formatTglIndo(p.createdAt)
                    : `${formatTglIndo(p.periodStart)} s/d ${formatTglIndo(p.periodEnd)}`;
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2 bg-black/5 dark:bg-white/5 rounded-lg px-2.5 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-emerald-400">{rupiah(p.netSalary)}</div>
                        <div className="text-[10px] text-text-muted truncate">
                          {tglStr}
                          {p.totalDeductionBon > 0 && ` · Potong: ${rupiah(p.totalDeductionBon)}`}
                          {p.sisaBon > 0 && ` · Sisa: ${rupiah(p.sisaBon)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => onOpenStruk(p, detail)}
                          title="Lihat Struk / Cetak Thermal"
                          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-muted hover:text-primary"
                        >
                          <Printer size={13} />
                        </button>
                        <button
                          onClick={() => handleDeletePayroll(p.id)}
                          title="Hapus Riwayat"
                          className="p-1.5 rounded hover:bg-danger/10 text-text-muted hover:text-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ STRUK & PRINT THERMAL MODAL ============
const StrukModal: React.FC<{
  data: { payroll: Payroll; employee: EmployeeDetail };
  onClose: () => void;
  onPrint: () => void;
  onSendWA: () => void;
}> = ({ data, onClose, onPrint, onSendWA }) => {
  const { payroll: p, employee: emp } = data;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-3"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-center p-3.5 border-b border-border bg-black/5">
          <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <Printer size={14} className="text-primary" /> Struk Gaji Karyawan
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1"><X size={16} /></button>
        </div>

        {/* Struk Card View (Thermal 58mm style) */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-white text-black font-mono text-xs select-all">
          <div className="text-center font-bold text-sm tracking-wide">VAULTPRO ENTERPRISE</div>
          <div className="text-center text-[10px] text-gray-600 mb-2">BUKTI PENGGAJIAN KARYAWAN</div>
          <div className="border-t border-b border-dashed border-gray-400 py-1.5 my-2 leading-relaxed">
            <div className="flex justify-between"><span>Nama:</span><strong className="uppercase">{emp.name}</strong></div>
            <div className="flex justify-between"><span>Tipe:</span><span>{emp.salaryType}</span></div>
            <div className="flex justify-between">
              <span>Periode:</span>
              <span className="text-[10px] text-right">
                {(!p.periodStart && !p.periodEnd) ? '-' : `${formatTglIndo(p.periodStart)} - ${formatTglIndo(p.periodEnd)}`}
              </span>
            </div>
            {p.attendanceDays > 0 && (
              <div className="flex justify-between"><span>Kehadiran:</span><span>{p.attendanceDays} Hari</span></div>
            )}
            <div className="flex justify-between"><span>Tgl Bayar:</span><span>{formatTglIndo(p.createdAt)}</span></div>
          </div>

          <div className="py-1 leading-relaxed">
            <div className="flex justify-between font-bold">
              <span>TOTAL GAJI:</span>
              <span>{rupiah(p.basicSalaryCalculated)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Potong Kasbon:</span>
              <span>- {p.totalDeductionBon > 0 ? rupiah(p.totalDeductionBon) : 'Rp 0'}</span>
            </div>
            {p.sisaBon > 0 && (
              <div className="flex justify-between text-amber-700 text-[10px]">
                <span>Sisa Bon Depan:</span>
                <span>{rupiah(p.sisaBon)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-b-2 border-black py-2 my-2 flex justify-between items-center text-sm font-black">
            <span>GAJI DITERIMA:</span>
            <span>{rupiah(p.netSalary)}</span>
          </div>

          <div className="text-[10px] text-gray-700 leading-tight">
            <div>Catatan: {p.notes || '-'}</div>
            <div className="text-center text-gray-500 mt-4 italic">
              Terima kasih atas kerja keras & dedikasinya.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 border-t border-border bg-black/5 flex gap-2">
          <button
            onClick={onSendWA}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
          >
            <MessageCircle size={13} /> Kirim WA
          </button>
          <button
            onClick={onPrint}
            className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
          >
            <Printer size={13} /> Cetak Struk
          </button>
        </div>
      </div>
    </div>
  );
};

export default Employees;
