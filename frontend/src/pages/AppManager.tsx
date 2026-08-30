import React, { useState, useEffect } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { encryptData, decryptData } from '../utils/crypto';
import { API_URL } from '../config';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Plus, Search, Globe, Smartphone, Monitor, Folder, Code, 
  ExternalLink, Copy, MoreVertical, Edit2, Trash2, LayoutGrid, CheckCircle2, Clock
} from 'lucide-react';

interface AppProject {
  id: string;
  title: string;
  description: string;
  status: 'development' | 'live';
  techStack: string;
  localPath: string;
  deployments: {
    saas: string;
    android: string;
    desktop: string;
  };
}

export const AppManager: React.FC = () => {
  const { masterPassword } = useVaultStore();
  const [apps, setApps] = useState<AppProject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [formData, setFormData] = useState<AppProject>({
    id: '',
    title: '',
    description: '',
    status: 'development',
    techStack: '',
    localPath: '',
    deployments: { saas: '', android: '', desktop: '' }
  });

  const fetchApps = async () => {
    if (!masterPassword) return;
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      if (res.data.success) {
        const appItems = res.data.data.filter((item: any) => item.type === 'app_project');
        
        const decryptedApps = await Promise.all(
          appItems.map(async (item: any) => {
            try {
              const dec = JSON.parse(await decryptData(item.encryptedData, masterPassword));
              return { id: item.id, title: item.title, ...dec };
            } catch (e) {
              return null;
            }
          })
        );
        
        setApps(decryptedApps.filter(Boolean) as AppProject[]);
      }
    } catch (e) {
      toast.error('Gagal mengambil data aplikasi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [masterPassword]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return toast.error('Nama Aplikasi wajib diisi!');
    if (!masterPassword) return toast.error('Brankas terkunci!');

    const toastId = toast.loading('Menyimpan data aplikasi...');
    
    try {
      const dataToEncrypt = JSON.stringify({
        description: formData.description,
        status: formData.status,
        techStack: formData.techStack,
        localPath: formData.localPath,
        deployments: formData.deployments
      });
      
      const encryptedData = await encryptData(dataToEncrypt, masterPassword);
      
      const payload = {
        type: 'app_project',
        title: formData.title,
        encryptedData,
        favorite: false
      };

      if (formData.id) {
        await axios.put(`${API_URL}/api/vault/${formData.id}`, payload, { withCredentials: true });
        toast.success('Aplikasi diperbarui!', { id: toastId });
      } else {
        await axios.post(`${API_URL}/api/vault`, payload, { withCredentials: true });
        toast.success('Aplikasi baru ditambahkan!', { id: toastId });
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchApps();
    } catch (e) {
      toast.error('Gagal menyimpan aplikasi', { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data aplikasi ini?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/vault/${id}`, { withCredentials: true });
      toast.success('Aplikasi dihapus');
      fetchApps();
    } catch (e) {
      toast.error('Gagal menghapus aplikasi');
    }
  };

  const handleEdit = (app: AppProject) => {
    setFormData(app);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      id: '', title: '', description: '', status: 'development', techStack: '', localPath: '',
      deployments: { saas: '', android: '', desktop: '' }
    });
  };

  const copyToClipboard = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${type} disalin ke clipboard!`);
  };

  const filteredApps = apps.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border bg-black/5 dark:bg-white/5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <LayoutGrid className="text-indigo-500" /> App Manager
          </h2>
          <p className="text-sm text-text-muted mt-1">Pusat kendali dan organisasi semua portofolio aplikasi Anda.</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Cari aplikasi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#1a1a1a] border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          </div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm shadow-indigo-500/20 flex items-center gap-2 shrink-0"
          >
            <Plus size={18} /> <span className="hidden sm:inline">Tambah App</span>
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#fdfdfc] dark:bg-[#1e1e1e]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-text-muted">Memuat data aplikasi...</div>
        ) : filteredApps.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center text-text-muted opacity-60">
            <LayoutGrid size={64} className="mb-4 text-indigo-500/50" />
            <p>Belum ada aplikasi yang terdaftar.</p>
            <p className="text-xs mt-1">Klik "Tambah App" untuk mulai mendata portofolio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredApps.map(app => (
              <div key={app.id} className="bg-white dark:bg-surface border border-border rounded-xl p-5 hover:border-indigo-500/30 transition-all group shadow-sm">
                
                {/* Card Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary mb-1 uppercase tracking-tight">{app.title}</h3>
                    <div className="flex items-center gap-2 text-xs">
                      {app.status === 'live' ? (
                        <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                          <CheckCircle2 size={12} /> LIVE / DEPLOYED
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                          <Clock size={12} /> DEVELOPMENT
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(app)} className="p-1.5 text-text-muted hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(app.id)} className="p-1.5 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>

                {/* Tech & Desc */}
                <p className="text-sm text-text-secondary line-clamp-2 mb-4 h-10">{app.description || '-'}</p>
                
                {app.techStack && (
                  <div className="flex items-center gap-1.5 text-xs text-text-muted mb-4 bg-black/5 dark:bg-white/5 w-fit px-2 py-1 rounded-md border border-border">
                    <Code size={14} /> {app.techStack}
                  </div>
                )}

                {/* Deployment Links */}
                <div className="space-y-2 mt-auto border-t border-border pt-4">
                  {/* Local Path */}
                  <div 
                    onClick={() => copyToClipboard(app.localPath, 'Path Lokal')}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono transition-colors cursor-pointer ${app.localPath ? 'bg-secondary/20 hover:bg-secondary/40 text-text-primary' : 'bg-black/5 dark:bg-white/5 text-text-muted opacity-50'}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder size={14} className="shrink-0" />
                      <span className="truncate">{app.localPath || 'Local Path belum diset'}</span>
                    </div>
                    {app.localPath && <Copy size={12} className="shrink-0 ml-2 opacity-50" />}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* SaaS */}
                    {app.deployments.saas ? (
                      <a href={app.deployments.saas} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors border border-blue-500/20 gap-1 text-center group/btn">
                        <Globe size={16} className="group-hover/btn:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold">Web SaaS</span>
                      </a>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-black/5 dark:bg-white/5 text-text-muted opacity-40 border border-border gap-1 text-center">
                        <Globe size={16} />
                        <span className="text-[10px] font-semibold">Web SaaS</span>
                      </div>
                    )}

                    {/* Android */}
                    <div onClick={() => copyToClipboard(app.deployments.android, 'Path APK Android')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors border gap-1 text-center cursor-pointer group/btn ${app.deployments.android ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-black/5 dark:bg-white/5 text-text-muted opacity-40 border-border'}`}>
                      <Smartphone size={16} className={app.deployments.android ? "group-hover/btn:scale-110 transition-transform" : ""} />
                      <span className="text-[10px] font-bold">{app.deployments.android ? 'Copy APK' : 'Android'}</span>
                    </div>

                    {/* Desktop */}
                    <div onClick={() => copyToClipboard(app.deployments.desktop, 'Path Desktop EXE')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors border gap-1 text-center cursor-pointer group/btn ${app.deployments.desktop ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/20' : 'bg-black/5 dark:bg-white/5 text-text-muted opacity-40 border-border'}`}>
                      <Monitor size={16} className={app.deployments.desktop ? "group-hover/btn:scale-110 transition-transform" : ""} />
                      <span className="text-[10px] font-bold">{app.deployments.desktop ? 'Copy EXE' : 'Desktop'}</span>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-border flex justify-between items-center bg-black/5 dark:bg-white/5 shrink-0">
              <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <LayoutGrid className="text-indigo-500" /> 
                {formData.id ? 'Edit Aplikasi' : 'Tambah Aplikasi Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary p-2"><MoreVertical size={20} className="rotate-90" /></button>
            </div>
            
            <form onSubmit={handleSave} className="overflow-y-auto p-4 md:p-6 space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase">Nama Aplikasi *</label>
                    <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white dark:bg-[#1a1a1a] border border-border rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all uppercase font-bold" placeholder="Contoh: POS SYSTEM" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase">Status Rilis</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full bg-white dark:bg-[#1a1a1a] border border-border rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer">
                      <option value="development">Masih di Lokal (Development)</option>
                      <option value="live">Sudah Rilis (Deployed / Live)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase">Tech Stack / Framework</label>
                    <input type="text" value={formData.techStack} onChange={e => setFormData({...formData, techStack: e.target.value})} className="w-full bg-white dark:bg-[#1a1a1a] border border-border rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="Contoh: React, Vite, Node.js" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase">Deskripsi / Catatan</label>
                    <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} className="w-full bg-white dark:bg-[#1a1a1a] border border-border rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none" placeholder="Deskripsi singkat fungsi aplikasi ini..."></textarea>
                  </div>
                </div>

                {/* Right Column (Deployments) */}
                <div className="space-y-4 bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-border">
                  <h4 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2 border-b border-border pb-2">
                    <Globe size={16} className="text-blue-500" /> Titik Lokasi & Deployment
                  </h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5 flex items-center gap-1.5"><Folder size={12}/> Path Folder Lokal</label>
                    <input type="text" value={formData.localPath} onChange={e => setFormData({...formData, localPath: e.target.value})} className="w-full bg-white dark:bg-[#1a1a1a] border border-border rounded-lg px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="D:\projects\pos-system" />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5 flex items-center gap-1.5"><Globe size={12}/> URL Web SaaS</label>
                    <input type="url" value={formData.deployments.saas} onChange={e => setFormData({...formData, deployments: {...formData.deployments, saas: e.target.value}})} className="w-full bg-white dark:bg-[#1a1a1a] border border-border rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="https://pos.domain.com" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5 flex items-center gap-1.5"><Smartphone size={12}/> Lokasi File APK (Android)</label>
                    <input type="text" value={formData.deployments.android} onChange={e => setFormData({...formData, deployments: {...formData.deployments, android: e.target.value}})} className="w-full bg-white dark:bg-[#1a1a1a] border border-border rounded-lg px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="F:\APLIKASI KU\apk\pos.apk" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5 flex items-center gap-1.5"><Monitor size={12}/> Lokasi File EXE (Desktop)</label>
                    <input type="text" value={formData.deployments.desktop} onChange={e => setFormData({...formData, deployments: {...formData.deployments, desktop: e.target.value}})} className="w-full bg-white dark:bg-[#1a1a1a] border border-border rounded-lg px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="F:\APLIKASI KU\exe\pos-setup.exe" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-text-secondary hover:bg-secondary/50 transition-colors">Batal</button>
                <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-transform active:scale-95 shadow-sm shadow-indigo-500/20">
                  Simpan Aplikasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
