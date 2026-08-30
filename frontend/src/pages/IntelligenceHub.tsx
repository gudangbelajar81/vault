import React, { useState, useEffect } from 'react';
import { Radar, Search, Activity, Video, MapPin, Camera, PlaySquare, Users, Megaphone, Eye, Heart, MessageCircle, Share2, Copy, BookmarkPlus, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useVaultStore } from '../store/vaultStore';
import { decryptData } from '../utils/crypto';
import { API_URL } from '../config';

export const IntelligenceHub: React.FC = () => {
  const { masterPassword } = useVaultStore();
  const [activeTab, setActiveTab] = useState<'tiktok' | 'instagram' | 'maps' | 'youtube' | 'facebook' | 'fbads'>('tiktok');
  const [keyword, setKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [apifyKey, setApifyKey] = useState('');

  // 1. Fetch Apify Key on Mount
  useEffect(() => {
    const fetchKey = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
        if (res.data.success) {
          for (const item of res.data.data) {
            if ((item.type === 'api' || item.type === 'api_key') && item.title.toLowerCase().includes('apify')) {
              if (!masterPassword) return;
              const dec = JSON.parse(await decryptData(item.encryptedData, masterPassword));
              // Support both structure formats (Settings vs ApiKeys page)
              if (dec.keys && dec.keys.length > 0) {
                 setApifyKey(dec.keys[0]);
              } else if (dec.accounts && dec.accounts[0] && dec.accounts[0].apis && dec.accounts[0].apis[0]) {
                 setApifyKey(dec.accounts[0].apis[0].key);
              }
              break;
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch Apify Key', e);
      }
    };
    fetchKey();
  }, [masterPassword]);

  // 2. Handle Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return toast.error('Masukkan kata kunci pencarian!');
    if (!apifyKey) return toast.error('Kunci Apify API belum disetting di menu Kunci API!');
    if (activeTab !== 'tiktok') return toast.error('Modul ini masih dalam tahap pengembangan.');

    setIsSearching(true);
    setResults([]);
    const toastId = toast.loading('Memulai robot Apify... (Ini bisa memakan waktu 1-3 menit)');

    try {
      // Endpoint to run TikTok scraper synchronously and get data
      // Note: We use a lightweight actor if possible, or standard apify/tiktok-scraper
      const actorId = 'apify~tiktok-scraper'; // or clockwork~tiktok-scraper
      
      // Because Apify runs can take minutes, we start the run first
      const runRes = await axios.post(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyKey}`, {
        hashtags: [keyword.replace('#', '')],
        resultsPerPage: 5,
        shouldDownloadVideos: false,
        shouldDownloadCovers: true
      });

      const runId = runRes.data.data.id;
      const defaultDatasetId = runRes.data.data.defaultDatasetId;

      toast.loading('Robot sedang bekerja, menyedot data...', { id: toastId });

      // Poll for status
      let isFinished = false;
      let attempts = 0;
      while (!isFinished && attempts < 30) { // max 30 * 5s = 150s
        await new Promise(resolve => setTimeout(resolve, 5000));
        const statusRes = await axios.get(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
        const status = statusRes.data.data.status;
        
        if (status === 'SUCCEEDED') {
          isFinished = true;
        } else if (status === 'FAILED' || status === 'TIMED-OUT' || status === 'ABORTED') {
          throw new Error(`Robot gagal: ${status}`);
        }
        attempts++;
      }

      if (!isFinished) throw new Error('Waktu habis saat menunggu robot.');

      toast.loading('Merapikan hasil data...', { id: toastId });

      // Fetch Dataset
      const dataRes = await axios.get(`https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${apifyKey}`);
      
      if (dataRes.data && dataRes.data.length > 0) {
        setResults(dataRes.data);
        toast.success('Penyedotan selesai!', { id: toastId });
      } else {
        toast.error('Tidak ada hasil viral untuk kata kunci ini.', { id: toastId });
      }

    } catch (error: any) {
      toast.error(error.message || 'Gagal terhubung ke pabrik robot Apify.', { id: toastId });
      
      // FALLBACK MOCK DATA FOR DEMO IF APIFY ACTOR FAILS OR REQUIRES SUBSCRIPTION
      // Apify's TikTok scraper often requires specific inputs or proxy access. 
      // We inject dummy data so the UI doesn't look broken if it errors out for the user right now.
      setTimeout(() => {
        setResults([
          {
            id: '12345',
            text: `Tren terbaru ${keyword}! Sangat viral! #fyp`,
            videoMeta: { coverUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&q=80' },
            playCount: 1540000,
            diggCount: 230000,
            commentCount: 4500,
            shareCount: 12000,
            webVideoUrl: `https://tiktok.com/@user/video/12345`
          },
           {
            id: '67890',
            text: `Tips rahasia untuk ${keyword}. Simpan video ini!`,
            videoMeta: { coverUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&q=80' },
            playCount: 890000,
            diggCount: 110000,
            commentCount: 2100,
            shareCount: 5000,
            webVideoUrl: `https://tiktok.com/@user/video/67890`
          }
        ]);
        toast.success('Menggunakan data sampel (Demo) karena API gagal.', { id: toastId, icon: '⚠️' });
      }, 1000);

    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveToNotepad = (item: any) => {
    const draft = localStorage.getItem('smart_notepad_draft') || '';
    const newText = `\n\n[IDE KONTEN TIKTOK]\nCaption: ${item.text}\nViews: ${item.playCount.toLocaleString()}\nLink: ${item.webVideoUrl}`;
    localStorage.setItem('smart_notepad_draft', draft + newText);
    
    // Trigger storage event for cross-tab sync
    window.dispatchEvent(new Event('storage'));
    
    toast.success('Ide dikirim ke Meja Kerja (Notepad)!');
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-2xl overflow-hidden shadow-sm relative">
      {/* Header */}
      <div className="bg-black/5 dark:bg-white/5 border-b border-border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400 flex items-center gap-2">
            <Radar className="text-emerald-500" /> Radar Tren
          </h2>
          <p className="text-xs text-text-muted mt-1">Pusat Intelijen Pasar (Powered by Apify Robotics)</p>
        </div>
        
        {!apifyKey && (
          <div className="flex items-center gap-2 text-xs text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
            <AlertCircle size={14} /> Belum ada Kunci Apify API
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4 pt-2 gap-6 overflow-x-auto no-scrollbar shrink-0 bg-black/5 dark:bg-white/5">
        <TabButton active={activeTab === 'tiktok'} onClick={() => setActiveTab('tiktok')} icon={<PlaySquare size={16} />} label="TikTok" activeColor="text-emerald-500" activeBorder="border-emerald-500" />
        <TabButton active={activeTab === 'instagram'} onClick={() => setActiveTab('instagram')} icon={<Camera size={16} />} label="Instagram" activeColor="text-rose-500" activeBorder="border-rose-500" />
        <TabButton active={activeTab === 'youtube'} onClick={() => setActiveTab('youtube')} icon={<Video size={16} />} label="YouTube" activeColor="text-red-500" activeBorder="border-red-500" />
        <TabButton active={activeTab === 'maps'} onClick={() => setActiveTab('maps')} icon={<MapPin size={16} />} label="G-Maps" activeColor="text-blue-500" activeBorder="border-blue-500" />
      <TabButton active={activeTab === 'facebook'} onClick={() => setActiveTab('facebook')} icon={<Users size={16} />} label="Facebook Pro" activeColor="text-blue-600" activeBorder="border-blue-600" />
        <TabButton active={activeTab === 'fbads'} onClick={() => setActiveTab('fbads')} icon={<Megaphone size={16} />} label="FB Ads" activeColor="text-orange-500" activeBorder="border-orange-500" />
      </div>

      {/* Search Bar */}
      <div className="p-4 shrink-0">
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={activeTab === 'tiktok' ? 'Masukkan hashtag TikTok (contoh: bajulebaran, resepmasakan)' : 'Fitur ini segera hadir...'}
            disabled={activeTab !== 'tiktok'}
            className="w-full bg-white dark:bg-[#1a1a1a] border border-border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <button
            type="submit"
            disabled={isSearching || activeTab !== 'tiktok'}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />} 
            <span className="hidden sm:inline">Pindai</span>
          </button>
        </form>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#fdfdfc] dark:bg-[#1e1e1e]">
        {results.length === 0 && !isSearching ? (
          <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-50">
            <Radar size={48} className="mb-4" />
            <p>Masukkan kata kunci untuk memulai pemindaian radar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {results.map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-surface border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                {/* Thumbnail */}
                <div className="h-48 bg-black/10 relative overflow-hidden">
                  <img src={item.videoMeta?.coverUrl || item.coverUrl} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-white text-[10px] font-bold flex items-center gap-1">
                    <Eye size={12} /> {item.playCount?.toLocaleString()}
                  </div>
                </div>
                
                {/* Stats Row */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-border bg-black/5 dark:bg-white/5 text-xs font-semibold text-text-secondary">
                  <div className="flex items-center gap-1 text-rose-500" title="Likes">
                    <Heart size={14} /> {item.diggCount?.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1 text-blue-500" title="Comments">
                    <MessageCircle size={14} /> {item.commentCount?.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1 text-emerald-500" title="Shares">
                    <Share2 size={14} /> {item.shareCount?.toLocaleString()}
                  </div>
                </div>

                {/* Caption */}
                <div className="p-4 flex-1">
                  <p className="text-sm text-text-primary line-clamp-3 leading-relaxed">{item.text}</p>
                </div>
                
                {/* Actions */}
                <div className="p-4 pt-0 flex gap-2">
                  <a href={item.webVideoUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex justify-center items-center gap-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-primary py-2 rounded-lg text-xs font-bold transition-colors">
                    <PlaySquare size={14} /> Tonton
                  </a>
                  <button onClick={() => handleSaveToNotepad(item)} className="flex-1 flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold transition-colors shadow-sm shadow-emerald-500/20">
                    <BookmarkPlus size={14} /> Simpan Ide
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label, activeColor, activeBorder }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 pb-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
      active ? `${activeColor} ${activeBorder}` : 'text-text-muted border-transparent hover:text-text-primary'
    }`}
  >
    {icon} {label}
  </button>
);
