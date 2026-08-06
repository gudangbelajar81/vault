import React, { useState, useEffect } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { Shield, Key, Download, RefreshCw, CheckCircle, AlertCircle, HardDrive, Fingerprint, Trash2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';
import { encryptData, decryptData } from '../utils/crypto';
import { startRegistration } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';

export const Settings = () => {
  const { masterPassword, setMasterPassword } = useVaultStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [exporting, setExporting] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/webauthn/devices`, { withCredentials: true });
      if (res.data.success) {
        setDevices(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch devices', error);
    }
  };

  const handleRegisterDevice = async () => {
    setRegistering(true);
    try {
      // 1. Get options from server
      const optionsRes = await axios.get(`${API_URL}/api/webauthn/generate-registration-options`, { withCredentials: true });
      const options = optionsRes.data.data;

      // 2. Pass options to browser authenticator
      let attResp;
      try {
        attResp = await startRegistration(options);
      } catch (error: any) {
        if (error.name === 'InvalidStateError') {
          toast.error('Perangkat ini sudah terdaftar!');
        } else {
          toast.error(error.message);
        }
        setRegistering(false);
        return;
      }

      // 3. Send response back to server
      const verificationRes = await axios.post(`${API_URL}/api/webauthn/verify-registration`, {
        response: attResp,
        deviceName: `Browser on ${navigator.userAgent.split(' ')[0]}` // Simple fallback name
      }, { withCredentials: true });

      if (verificationRes.data.success) {
        toast.success('Sidik Jari / FaceID berhasil didaftarkan!');
        fetchDevices();
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Gagal mendaftarkan perangkat');
    } finally {
      setRegistering(false);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Hapus perangkat ini? Anda tidak bisa lagi login dengan biometrik dari perangkat ini.')) return;
    try {
      await axios.delete(`${API_URL}/api/webauthn/devices/${id}`, { withCredentials: true });
      toast.success('Perangkat dihapus');
      fetchDevices();
    } catch (error) {
      toast.error('Gagal menghapus perangkat');
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    if (!masterPassword) return;
    setExporting(true);
    try {
      // 1. Ambil semua vault items
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      const items = res.data.data || [];
      
      // 2. Dekripsi
      const decrypted = await Promise.all(
        items.map(async (item: any) => {
          try {
            const dataStr = await decryptData(item.encryptedData, masterPassword);
            const parsed = JSON.parse(dataStr);
            return {
              Type: item.type,
              Title: item.title,
              Favorite: item.favorite ? 'Yes' : 'No',
              ...parsed
            };
          } catch (e) {
            return {
              Type: item.type,
              Title: item.title,
              Error: 'Failed to decrypt'
            };
          }
        })
      );

      // 3. Download format
      let content = '';
      let mime = '';
      let ext = '';
      
      if (format === 'json') {
        content = JSON.stringify(decrypted, null, 2);
        mime = 'application/json';
        ext = 'json';
      } else {
        // Simple CSV converter
        if (decrypted.length === 0) return alert('Data kosong');
        
        // Ambil semua kemungkinan kolom
        const allKeys = new Set<string>();
        decrypted.forEach(item => Object.keys(item).forEach(k => allKeys.add(k)));
        const headers = Array.from(allKeys);
        
        const csvRows = [headers.join(',')];
        
        for (const row of decrypted) {
          const values = headers.map(header => {
            const val = row[header] || '';
            const valStr = String(val).replace(/"/g, '""'); // escape quotes
            return `"${valStr}"`;
          });
          csvRows.push(values.join(','));
        }
        
        content = csvRows.join('\n');
        mime = 'text/csv';
        ext = 'csv';
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vaultpro_backup_${new Date().toISOString().split('T')[0]}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor data');
    } finally {
      setExporting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (oldPassword !== masterPassword) {
      setErrorMsg('Password lama tidak cocok dengan sesi saat ini.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Password baru harus minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }

    setProcessing(true);
    try {
      // 1. Tarik semua data
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      const items = res.data.data || [];

      if (items.length === 0) {
        setMasterPassword(newPassword);
        setSuccessMsg('Master Password berhasil diubah (tidak ada data yang perlu dienkripsi ulang).');
        setOldPassword(''); setNewPassword(''); setConfirmPassword('');
        setProcessing(false);
        return;
      }

      // 2. Bongkar dengan password lama
      const decryptedItems = await Promise.all(
        items.map(async (item: any) => {
          const dataStr = await decryptData(item.encryptedData, oldPassword);
          return { id: item.id, dataStr };
        })
      );

      // 3. Bungkus ulang dengan password baru
      const reencryptedItems = await Promise.all(
        decryptedItems.map(async (item: any) => {
          const newEncryptedData = await encryptData(item.dataStr, newPassword);
          return { id: item.id, encryptedData: newEncryptedData };
        })
      );

      // 4. Kirim pembaruan massal ke server
      await axios.put(`${API_URL}/api/vault`, { items: reencryptedItems }, { withCredentials: true });

      // 5. Update state sesi lokal
      setMasterPassword(newPassword);
      setSuccessMsg(`Berhasil! ${items.length} item telah dienkripsi ulang dengan kunci baru.`);
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');

    } catch (err) {
      console.error(err);
      setErrorMsg('Terjadi kesalahan saat memproses data. Kunci tidak jadi diganti untuk mencegah kerusakan data.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text-primary">Settings</h2>
        <p className="text-text-muted text-sm mt-1">Kelola keamanan brankas dan cadangan data Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Security Settings */}
        <div className="bg-surface/30 border border-border rounded-xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <Key size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Ganti Master Password</h3>
              <p className="text-xs text-text-muted">Enkripsi ulang seluruh isi brankas</p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 bg-danger/10 border border-danger/20 text-danger p-3 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-success/10 border border-success/20 text-success p-3 rounded-lg text-sm flex items-start gap-2">
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-text-muted mb-1 block">Master Password Saat Ini</label>
              <input 
                type="password" required value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-muted mb-1 block">Master Password Baru</label>
              <input 
                type="password" required minLength={8} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-muted mb-1 block">Konfirmasi Password Baru</label>
              <input 
                type="password" required minLength={8} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <div className="mt-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-xs text-warning flex gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>Proses ini akan mengunduh seluruh data Anda, membungkusnya ulang dengan kunci baru, dan mengunggahnya kembali. Jangan tutup halaman saat proses berjalan.</span>
              </p>
            </div>

            <button 
              type="submit" disabled={processing || !oldPassword || !newPassword || !confirmPassword}
              className="mt-2 w-full bg-primary hover:bg-primary/90 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
            >
              {processing ? (
                <><RefreshCw size={18} className="animate-spin" /> Sedang Mengenkripsi Ulang...</>
              ) : (
                <><Shield size={18} /> Ganti & Enkripsi Ulang Data</>
              )}
            </button>
          </form>
        </div>

        {/* Export Data */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface/30 border border-border rounded-xl p-6 backdrop-blur-sm h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-success/20 text-success flex items-center justify-center">
                <HardDrive size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">Backup & Export</h3>
                <p className="text-xs text-text-muted">Unduh seluruh isi brankas dalam format terdekripsi</p>
              </div>
            </div>

            <p className="text-sm text-text-muted mb-6">
              Amankan salinan lokal (offline) dari seluruh password dan kunci Anda. 
              Data akan diunduh dalam kondisi <strong className="text-text-primary">SUDAH TERDEKRIPSI</strong> (bisa dibaca). 
              Simpan file hasil unduhan di tempat yang sangat aman.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => handleExport('csv')}
                disabled={exporting}
                className="flex-1 bg-surface hover:bg-black/5 dark:hover:bg-white/5 border border-border text-text-primary px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Download size={18} />
                Export CSV
              </button>
              <button 
                onClick={() => handleExport('json')}
                disabled={exporting}
                className="flex-1 bg-surface hover:bg-black/5 dark:hover:bg-white/5 border border-border text-text-primary px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Download size={18} />
                Export JSON
              </button>
            </div>
          </div>

          {/* Biometrics Settings */}
          <div className="bg-surface/30 border border-border rounded-xl p-6 backdrop-blur-sm h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center">
                <Fingerprint size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">Keamanan & Perangkat</h3>
                <p className="text-xs text-text-muted">Login tanpa password dengan Biometrik (WebAuthn)</p>
              </div>
            </div>

            <p className="text-sm text-text-muted mb-4">
              Daftarkan perangkat ini untuk login menggunakan Sidik Jari, FaceID, atau Windows Hello di masa mendatang.
            </p>

            <button 
              onClick={handleRegisterDevice}
              disabled={registering}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 mb-6"
            >
              {registering ? <RefreshCw size={18} className="animate-spin" /> : <Fingerprint size={18} />}
              Daftarkan Perangkat Ini
            </button>

            {devices.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Perangkat Terdaftar</h4>
                <div className="space-y-2">
                  {devices.map(device => (
                    <div key={device.id} className="flex items-center justify-between bg-black/5 dark:bg-black/40 border border-border p-3 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{device.deviceName}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">Didaftarkan: {new Date(device.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteDevice(device.id)}
                        className="text-danger hover:bg-danger/10 p-2 rounded-lg transition-colors"
                        title="Hapus Perangkat"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
