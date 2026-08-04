import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Key, Copy, CheckCircle, Package, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

export const LicenseManager = () => {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Expand State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  
  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };
  
  const [formData, setFormData] = useState({
    client_name: '',
    app_code: 'APP_KASIR',
    wa_number: '',
    machine_id: '',
    tier: 'BASIC',
    expiry_days: '365',
    expiry_unit: 'days'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [licRes, pkgRes] = await Promise.all([
        axios.get(`${API_URL}/api/licenses`, { withCredentials: true }),
        axios.get(`${API_URL}/api/packages`, { withCredentials: true })
      ]);
      setLicenses(licRes.data);
      setPackages(pkgRes.data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengambil data lisensi');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.post(`${API_URL}/api/generate`, formData, { withCredentials: true });
      toast.success('Lisensi berhasil dibuat!');
      setIsModalOpen(false);
      fetchData();
      
      // Copy to clipboard automatically
      navigator.clipboard.writeText(res.data.key);
      toast('Kunci telah disalin ke clipboard', { icon: '📋' });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal membuat lisensi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus lisensi ini secara permanen?')) return;
    try {
      await axios.delete(`${API_URL}/api/licenses/${id}`, { withCredentials: true });
      toast.success('Lisensi dihapus');
      fetchData();
    } catch (error) {
      toast.error('Gagal menghapus');
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Disalin!');
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 md:pb-0">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-base font-bold text-text-primary">
            Pengelola Lisensi
          </h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg hover:shadow-lg hover:shadow-primary/25 transition-all font-medium text-xs"
        >
          <Key size={14} />
          <span className="hidden sm:inline">Buat Lisensi</span>
          <span className="sm:hidden">Buat</span>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {licenses.map(lic => {
          const isExpanded = expandedId === lic.id;
          return (
            <div key={lic.id} className="bg-surface/50 backdrop-blur-xl border border-border/50 rounded-lg hover:border-primary/50 transition-colors overflow-hidden">
              <div 
                className="flex justify-between items-center p-3 cursor-pointer select-none"
                onClick={() => toggleExpand(lic.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-8 w-8 rounded-md bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Key size={14} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-text-primary uppercase text-xs truncate leading-tight">{lic.client_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase font-bold">
                        {lic.tier}
                      </span>
                      <span className="text-[9px] text-text-muted">{new Date(lic.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(lic.id); }} className="text-text-muted hover:text-danger transition-colors p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10">
                    <Trash2 size={14} />
                  </button>
                  <div className="text-text-muted p-1.5">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-3 pt-0 border-t border-border/50 bg-black/5 dark:bg-white/5">
                  <div className="space-y-1.5 mt-3 text-[10px]">
                    <div className="flex justify-between text-text-muted">
                      <span>Mesin ID</span>
                      <span className="font-mono text-text-primary">{lic.machine_id}</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>App Code</span>
                      <span className="text-text-primary">{lic.app_code}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <button 
                      onClick={() => copyKey(lic.license_key)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-black/5 dark:bg-black/40 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-text-primary text-[10px] font-medium transition-colors border border-border"
                    >
                      <Copy size={12} />
                      Salin Kunci (JWT)
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {licenses.length === 0 && (
          <div className="col-span-full py-12 text-center text-text-muted bg-surface/30 rounded-2xl border border-border border-dashed">
            <Key size={48} className="mx-auto mb-4 opacity-50" />
            <p>Belum ada lisensi yang dibuat.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden my-auto">
            <div className="p-3 border-b border-border flex justify-between items-center bg-black/5 dark:bg-white/5">
              <h2 className="text-sm font-semibold text-text-primary">Generate Lisensi Baru</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <Trash2 size={16} className="hidden" /> {/* Placeholder for close icon space */}
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleGenerate} className="p-3 space-y-2.5">
              <div>
                <label className="block text-[10px] font-medium text-text-muted mb-0.5">Nama Klien / Toko</label>
                <input
                  type="text"
                  required
                  value={formData.client_name}
                  onChange={e => setFormData({...formData, client_name: e.target.value})}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Budi Mart"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-medium text-text-muted mb-0.5">Machine ID (HWID)</label>
                <input
                  type="text"
                  required
                  value={formData.machine_id}
                  onChange={e => setFormData({...formData, machine_id: e.target.value.toUpperCase()})}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="M-XXXX-XXXX"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-text-muted mb-0.5">Paket (Tier)</label>
                  <select
                    value={formData.tier}
                    onChange={e => setFormData({...formData, tier: e.target.value})}
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {packages.map(pkg => (
                      <option key={pkg.tier_code} value={pkg.tier_code}>{pkg.tier_code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-text-muted mb-0.5">Kode Aplikasi</label>
                  <input
                    type="text"
                    required
                    value={formData.app_code}
                    onChange={e => setFormData({...formData, app_code: e.target.value})}
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-text-muted mb-0.5">Masa Aktif</label>
                  <input
                    type="number"
                    value={formData.expiry_days}
                    onChange={e => setFormData({...formData, expiry_days: e.target.value})}
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-text-muted mb-0.5">Satuan</label>
                  <select
                    value={formData.expiry_unit}
                    onChange={e => setFormData({...formData, expiry_unit: e.target.value})}
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="days">Hari</option>
                    <option value="minutes">Menit (Test)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-3 py-1.5 bg-black/10 dark:bg-white/10 text-text-primary rounded-lg hover:bg-black/20 dark:hover:bg-white/20 transition-colors text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 py-1.5 bg-primary text-white rounded-lg hover:shadow-lg hover:shadow-primary/25 transition-all text-xs font-medium disabled:opacity-50"
                >
                  {saving ? 'Membuat...' : 'Generate Kunci'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
