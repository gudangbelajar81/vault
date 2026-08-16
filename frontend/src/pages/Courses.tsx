import React, { useEffect, useState } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { Plus, Search, MoreVertical, Copy, ExternalLink, GraduationCap, X, RefreshCw, BookOpen, Eye, EyeOff, PlayCircle, Users, Clock, CheckCircle, BarChart2 , TrendingUp, Fingerprint, DollarSign, Link2 } from 'lucide-react';
import axios from 'axios';
import { encryptData, decryptData } from '../utils/crypto';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

interface CourseItem {
  id: string;
  type: string;
  title: string;
  favorite: boolean;
  decryptedData?: any;
  encryptedData: string;
}

export const Courses = () => {
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  
  const [formData, setFormData] = useState({
    id: '',
    category: '',
    platform: '',
    url: '',
    username: '',
    password: '',
    materials: [{ id: Date.now().toString() + 'm1', url: '' }],
    status: 'Belum Dimulai',
    progress: '',
    expiry: 'Lifetime',
    communities: [{ id: Date.now().toString() + 'c1', url: '' }],
    notes: '',
  });

  const fetchItems = async () => {
    if (!masterPassword) return;
    try {
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      const courseItems = (res.data.data || []).filter((i: any) => i.type === 'course');
      
      const decrypted = await Promise.all(
        courseItems.map(async (item: CourseItem) => {
          try {
            const dataStr = await decryptData(item.encryptedData, masterPassword);
            item.decryptedData = JSON.parse(dataStr);
          } catch (e) {
            item.decryptedData = { platform: 'Error' };
          }
          return item;
        })
      );
      setItems(decrypted);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [masterPassword]);

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (navigator.vibrate) navigator.vibrate(30);
    toast.success(`${label} disalin!`);
  };

  const resetForm = () => {
    setFormData({
      id: '', category: '', platform: '', url: '', username: '', password: '', 
      materials: [{ id: Date.now().toString() + 'm1', url: '' }],
      status: 'Belum Dimulai', progress: '', expiry: 'Lifetime', 
      communities: [{ id: Date.now().toString() + 'c1', url: '' }],
      notes: ''
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;
    setSaving(true);
    
    try {
      const dataToEncrypt = JSON.stringify({
        category: formData.category,
        platform: formData.platform,
        url: formData.url,
        username: formData.username,
        password: formData.password,
        materials: formData.materials.filter(m => m.url),
        status: formData.status,
        progress: formData.progress,
        expiry: formData.expiry,
        communities: formData.communities.filter(c => c.url),
        notes: formData.notes
      });
      
      const encryptedData = await encryptData(dataToEncrypt, masterPassword);
      
      const payload = {
        type: 'course',
        title: formData.platform,
        encryptedData,
        favorite: false
      };

      if (formData.id) {
        await axios.put(`${API_URL}/api/vault/${formData.id}`, payload, { withCredentials: true });
        toast.success('Berhasil mengubah Kursus');
      } else {
        await axios.post(`${API_URL}/api/vault`, payload, { withCredentials: true });
        toast.success('Berhasil menyimpan Kursus');
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan Data Kursus');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: CourseItem) => {
    const dec = item.decryptedData || {};
    
    // Backwards compatibility for old single materialUrl / communityUrl
    let mats = dec.materials || [];
    if (mats.length === 0 && dec.materialUrl) {
      mats = [{ id: Date.now().toString() + 'm1', url: dec.materialUrl }];
    } else if (mats.length === 0) {
      mats = [{ id: Date.now().toString() + 'm1', url: '' }];
    }

    let comms = dec.communities || [];
    if (comms.length === 0 && dec.communityUrl) {
      comms = [{ id: Date.now().toString() + 'c1', url: dec.communityUrl }];
    } else if (comms.length === 0) {
      comms = [{ id: Date.now().toString() + 'c1', url: '' }];
    }

    setFormData({
      id: item.id,
      category: dec.category || '',
      platform: item.title || dec.platform || '',
      url: dec.url || '',
      username: dec.username || '',
      password: dec.password || '',
      materials: mats,
      status: dec.status || 'Belum Dimulai',
      progress: dec.progress || '',
      expiry: dec.expiry || 'Lifetime',
      communities: comms,
      notes: dec.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus Data Kursus ini?')) return;
    try {
      await axios.delete(`${API_URL}/api/vault/${id}`, { withCredentials: true });
      toast.success('Berhasil menghapus');
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus');
    }
  };

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(search.toLowerCase()) || 
    (item.decryptedData?.category && item.decryptedData.category.toLowerCase().includes(search.toLowerCase())) ||
    (item.decryptedData?.notes && item.decryptedData.notes.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-bold text-text-primary">Manajemen Kursus</h2>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-transform active:scale-95 shadow-[0_0_10px_rgba(var(--color-primary),0.3)] text-xs"
        >
          <Plus size={14} />
          Tambah
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
        <input 
          type="text" 
          placeholder="Cari berdasarkan nama, kategori, atau catatan..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-text-muted/50 backdrop-blur-sm"
        />
      </div>

      <div className="flex-1 bg-surface/30 border border-border rounded-xl overflow-y-auto backdrop-blur-sm p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <RefreshCw className="animate-spin" size={20} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-text-muted py-10 opacity-50">
            <GraduationCap size={32} className="mb-2" />
            <p className="text-xs">Belum ada akses kursus.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
            {filteredItems.map(item => {
              const dec = item.decryptedData || {};
              
              let statusColor = "text-text-muted";
              if (dec.status === 'Selesai') statusColor = "text-success";
              if (dec.status === 'Sedang Dipelajari') statusColor = "text-warning";

              const mats = dec.materials || (dec.materialUrl ? [{ url: dec.materialUrl }] : []);
              const comms = dec.communities || (dec.communityUrl ? [{ url: dec.communityUrl }] : []);

              return (
              <div key={item.id} className="bg-surface border border-border rounded-lg p-3 hover:border-primary/50 transition-colors group relative flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary/20 to-secondary/20 text-white flex items-center justify-center shrink-0">
                      <BookOpen size={14} className="text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold text-sm leading-tight truncate">{item.title}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        {dec.category && (
                          <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-sm font-medium">{dec.category}</span>
                        )}
                        <span className={`text-[10px] font-medium flex items-center gap-1 ${statusColor}`}>
                           {dec.status === 'Selesai' && <CheckCircle size={10} />}
                           {dec.status === 'Sedang Dipelajari' && <RefreshCw size={10} className="animate-spin-slow" />}
                           {dec.status || 'Belum Dimulai'} {dec.progress ? `(${dec.progress}%)` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(item)} className="text-text-muted hover:text-white p-1"><MoreVertical size={14}/></button>
                    <button onClick={() => handleDelete(item.id)} className="text-danger hover:text-danger/80 p-1"><X size={14}/></button>
                  </div>
                </div>

                <div className="flex-1 mt-2">
                  <div className="bg-black/30 rounded-lg p-2 border border-border/50 mb-3 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="text-[10px] text-text-muted w-12 shrink-0">User</div>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-xs text-text-primary truncate font-mono">{dec.username || '-'}</span>
                        {dec.username && (
                          <button onClick={() => copyToClipboard(dec.username, 'Gmail')} className="text-text-muted hover:text-primary p-0.5 shrink-0"><Copy size={12}/></button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-[10px] text-text-muted w-12 shrink-0">Pass</div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-text-primary font-mono">
                          {showPassword[item.id] ? dec.password : '••••••••'}
                        </span>
                        {dec.password && (
                          <>
                            <button onClick={() => setShowPassword({...showPassword, [item.id]: !showPassword[item.id]})} className="text-text-muted hover:text-primary p-0.5 shrink-0">
                              {showPassword[item.id] ? <EyeOff size={12}/> : <Eye size={12}/>}
                            </button>
                            <button onClick={() => copyToClipboard(dec.password, 'Password')} className="text-text-muted hover:text-primary p-0.5 shrink-0"><Copy size={12}/></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {dec.notes && (
                    <div className="text-[10px] text-text-muted bg-black/5 dark:bg-black/30 p-2 rounded-lg line-clamp-2 mb-3 border border-border/30 italic">
                      {dec.notes}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-1 mt-auto">
                  {dec.url && (
                    <button 
                      onClick={() => window.open(dec.url.startsWith('http') ? dec.url : `https://${dec.url}`, '_blank')}
                      className="w-full col-span-full bg-primary/10 hover:bg-primary/20 text-primary py-1.5 rounded-lg border border-primary/20 flex items-center justify-center gap-1 transition-colors text-[10px] font-medium"
                    >
                      <ExternalLink size={12} /> Buka
                    </button>
                  )}
                  
                  {mats.length > 0 && mats.map((m: any, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => window.open(m.url.startsWith('http') ? m.url : `https://${m.url}`, '_blank')}
                      className="w-full bg-secondary/10 hover:bg-secondary/20 text-secondary py-1.5 rounded-lg border border-secondary/20 flex items-center justify-center gap-1 transition-colors text-[10px] font-medium"
                    >
                      <PlayCircle size={12} /> Materi {mats.length > 1 ? idx + 1 : ''}
                    </button>
                  ))}

                  {comms.length > 0 && comms.map((c: any, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => window.open(c.url.startsWith('http') ? c.url : `https://${c.url}`, '_blank')}
                      className="w-full bg-info/10 hover:bg-info/20 text-info py-1.5 rounded-lg border border-info/20 flex items-center justify-center gap-1 transition-colors text-[10px] font-medium"
                    >
                      <Users size={12} /> Grup {comms.length > 1 ? idx + 1 : ''}
                    </button>
                  ))}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-1 sm:p-4">
          <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-3 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-1">
                 <GraduationCap size={16} className="text-primary" />
                 {formData.id ? 'Edit Data Kursus' : 'Tambah Data Kursus'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-2.5 flex-1 overflow-y-auto flex flex-col gap-1">
              
              <div className="bg-black/5 dark:bg-black/20 border border-border/50 rounded-xl p-2 space-y-2">
                <h4 className="text-[9px] font-bold text-purple-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><BookOpen size={12}/> 1. Informasi Dasar</h4>
                <div className="grid grid-cols-12 gap-1">
                  <div className="col-span-5 md:col-span-3">
<input 
                      type="text" value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      placeholder="Kategori (Mis: Marketing, Bisnis)"
                      className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                  <div className="col-span-7 md:col-span-5">
<input 
                      type="text" required value={formData.platform}
                      onChange={e => setFormData({...formData, platform: e.target.value})}
                      placeholder="Nama Kursus *"
                      className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-4 mt-1 md:mt-0">
<input 
                      type="url" value={formData.url}
                      onChange={e => setFormData({...formData, url: e.target.value})}
                      placeholder="Link Web Utama (https://...)"
                      className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-black/5 dark:bg-black/20 border border-border/50 rounded-xl p-2">
                <h4 className="text-[9px] font-bold text-info uppercase tracking-wider mb-1.5">2. Kredensial Login</h4>
                <div className="grid grid-cols-12 gap-1">
                  <div className="col-span-12 md:col-span-6">
<div className="flex gap-1">
                      <input 
                        type="text" placeholder="Akun Gmail / Username"
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                        className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (formData.url) {
                            window.open(formData.url.startsWith('http') ? formData.url : `https://${formData.url}`, '_blank');
                          } else {
                            window.open('https://mail.google.com', '_blank');
                          }
                        }}
                        className="bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary px-3 rounded-lg transition-colors shrink-0 flex items-center justify-center gap-1 text-[10px] font-medium"
                        title="Buka Link Web"
                      >
                        <ExternalLink size={12} /> Buka
                      </button>
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-6">
<input 
                      type="text" placeholder="Password"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-black/5 dark:bg-black/20 border border-border/50 rounded-xl p-2">
                 <h4 className="text-[9px] font-bold text-pink-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Link2 size={12}/> 3. Direct Link Materi Khusus</h4>
                 
                 <div className="space-y-2">
                    {formData.materials.map((m, idx) => (
                      <div key={m.id} className="flex gap-1 items-end">
                        <div className="flex-1">
                          <input 
                            type="url" value={m.url}
                            onChange={e => {
                               const newMats = [...formData.materials];
                               newMats[idx].url = e.target.value;
                               setFormData({...formData, materials: newMats});
                            }}
                            placeholder={`Link Google Drive / YouTube ${idx + 1}`}
                            className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => window.open(m.url.startsWith('http') ? m.url : `https://${m.url}`, '_blank')}
                          disabled={!m.url}
                          className="bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-secondary h-[26px] px-3 rounded-lg transition-colors shrink-0 flex items-center justify-center gap-1 text-[10px] font-medium disabled:opacity-50"
                        >
                          <PlayCircle size={12} />
                        </button>
                        {formData.materials.length > 1 && (
                          <button 
                            type="button" onClick={() => setFormData({...formData, materials: formData.materials.filter(x => x.id !== m.id)})}
                            className="bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger h-[26px] px-2.5 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    
                    <button 
                      type="button" onClick={() => setFormData({...formData, materials: [...formData.materials, { id: Date.now().toString(), url: '' }]})}
                      className="mt-2 w-fit border border-dashed border-secondary/40 hover:border-secondary/80 text-secondary bg-transparent hover:bg-secondary/10 px-3 py-1 rounded-lg transition-colors text-[10px] font-medium flex items-center gap-1"
                    >
                      <Plus size={10} /> Materi
                    </button>
                 </div>
              </div>

              <div className="bg-black/5 dark:bg-black/20 border border-border/50 rounded-xl p-2 space-y-2">
                 <h4 className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><TrendingUp size={12}/> 4. Analitik & Komunitas</h4>
                 
                 <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-5 md:col-span-4">
<select 
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value})}
                        className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                      >
                        <option value="Belum Dimulai">Belum Dimulai</option>
                        <option value="Sedang Dipelajari">Sedang Dipelajari</option>
                        <option value="Selesai">Selesai</option>
                      </select>
                    </div>
                    <div className="col-span-3 md:col-span-4">
<input 
                        type="number" min="0" max="100" value={formData.progress}
                        onChange={e => setFormData({...formData, progress: e.target.value})}
                        placeholder="Progress (0-100%)"
                        className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-4">
<input 
                        type="text" value={formData.expiry}
                        onChange={e => setFormData({...formData, expiry: e.target.value})}
                        placeholder="Masa Aktif (Mis: Lifetime)"
                        className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    
                    <div className="space-y-2 col-span-12 mt-1">
                       {formData.communities.map((c, idx) => (
                         <div key={c.id} className="flex gap-1 items-end">
                           <div className="flex-1">
                             <input 
                               type="url" value={c.url}
                               onChange={e => {
                                  const newComms = [...formData.communities];
                                  newComms[idx].url = e.target.value;
                                  setFormData({...formData, communities: newComms});
                               }}
                               placeholder={`Link Grup Komunitas ${idx + 1} (Opsional)`}
                               className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                             />
                           </div>
                           <button 
                              type="button"
                              onClick={() => window.open(c.url.startsWith('http') ? c.url : `https://${c.url}`, '_blank')}
                              disabled={!c.url}
                              className="bg-info/10 hover:bg-info/20 border border-info/20 text-info h-[26px] px-3 rounded-lg transition-colors shrink-0 flex items-center justify-center gap-1 text-[10px] font-medium disabled:opacity-50"
                            >
                              <Users size={12} />
                            </button>
                           {formData.communities.length > 1 && (
                             <button 
                               type="button" onClick={() => setFormData({...formData, communities: formData.communities.filter(x => x.id !== c.id)})}
                               className="bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger h-[26px] px-2.5 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                             >
                               <X size={12} />
                             </button>
                           )}
                         </div>
                       ))}
                       
                       <button 
                         type="button" onClick={() => setFormData({...formData, communities: [...formData.communities, { id: Date.now().toString(), url: '' }]})}
                         className="mt-1 w-fit border border-dashed border-info/40 hover:border-info/80 text-info bg-transparent hover:bg-info/10 px-3 py-1 rounded-lg transition-colors text-[10px] font-medium flex items-center gap-1"
                       >
                         <Plus size={10} /> Grup
                       </button>
                    </div>
                 </div>

                 <div className="pt-2 border-t border-border/30 mt-2">
                    <textarea 
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                      placeholder="Catatan Penting"
                      rows={2}
                      className="w-full bg-surface/50 border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                    />
                 </div>
              </div>

            </form>

            <div className="p-3 border-t border-border flex justify-end gap-1 bg-surface/30">
              <button 
                type="button" onClick={() => setIsModalOpen(false)} 
                className="px-4 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium text-xs"
              >
                Batal
              </button>
              <button 
                type="submit" onClick={handleSave} disabled={saving || !formData.platform} 
                className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium shadow-md text-xs flex items-center gap-1"
              >
                {saving ? <RefreshCw className="animate-spin" size={12} /> : null}
                {saving ? 'Proses...' : 'Simpan'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
