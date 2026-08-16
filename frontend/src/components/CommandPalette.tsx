import React, { useEffect, useState, useRef } from 'react';
import { Search, X, Copy, Vault, Code2, BookOpen, Fingerprint, Library } from 'lucide-react';
import Fuse from 'fuse.js';
import axios from 'axios';
import { useVaultStore } from '../store/vaultStore';
import { decryptData } from '../utils/crypto';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

interface SearchItem {
  id: string;
  type: string;
  name: string;
  decrypted: any;
}

export const CommandPalette: React.FC = () => {
  const { isCommandOpen, setCommandOpen, masterPassword } = useVaultStore();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global hotkey Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(!isCommandOpen);
      }
      if (e.key === 'Escape' && isCommandOpen) {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandOpen, setCommandOpen]);

  // Fetch and decrypt data when opened (once)
  useEffect(() => {
    if (isCommandOpen && items.length === 0 && masterPassword) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
          if (res.data.success) {
            const decItems = await Promise.all(res.data.data.map(async (item: any) => {
              try {
                const decStr = await decryptData(item.encryptedData, masterPassword);
                return { ...item, decrypted: JSON.parse(decStr) };
              } catch (e) {
                return { ...item, decrypted: null };
              }
            }));
            // Filter out failed decryptions
            setItems(decItems.filter((i: any) => i.decrypted));
          }
        } catch (error) {
          console.error("Error fetching data for search", error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
    
    if (isCommandOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isCommandOpen, masterPassword, items.length]);

  // Fuse.js setup
  const fuse = React.useMemo(() => new Fuse(items, {
    keys: [
      'name',
      'decrypted.url',
      'decrypted.category',
      'decrypted.title',
      'decrypted.content',
      'decrypted.mainAccount.username',
      'decrypted.mainAccount.extra',
      'decrypted.credentials.username',
      'decrypted.apiKeys.name',
      'decrypted.note'
    ],
    threshold: 0.4,
    ignoreLocation: true
  }), [items]);

  const results = query ? fuse.search(query).map(r => r.item).slice(0, 15) : items.slice(0, 15);

  // Keyboard navigation
  useEffect(() => {
    const handleNav = (e: KeyboardEvent) => {
      if (!isCommandOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeItem = results[selectedIndex];
        if (activeItem) {
           const email = activeItem.decrypted?.mainAccount?.username;
           if (email) handleCopy(email, 'Email');
        }
      }
    };
    window.addEventListener('keydown', handleNav);
    return () => window.removeEventListener('keydown', handleNav);
  }, [isCommandOpen, results, selectedIndex]);

  // Auto scroll
  useEffect(() => {
    const activeEl = listRef.current?.children[selectedIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} disalin!`, { style: { background: '#10B981', color: '#fff' } });
  };

  if (!isCommandOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'login': return <Vault size={16} className="text-purple-400" />;
      case 'apikey': return <Code2 size={16} className="text-cyan-400" />;
      case 'course': return <BookOpen size={16} className="text-pink-400" />;
      case 'knowledge': return <Library size={16} className="text-rose-400" />;
      default: return <Search size={16} className="text-text-muted" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh] bg-black/60 backdrop-blur-md">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={() => setCommandOpen(false)} />
      
      <div className="relative w-full max-w-2xl bg-surface border border-border shadow-2xl shadow-primary/20 rounded-2xl overflow-hidden flex flex-col">
        
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-border bg-black/5 dark:bg-black/20">
          <Search size={20} className="text-primary animate-pulse" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none px-4 py-5 text-lg text-text-primary placeholder:text-text-muted"
            placeholder="Cari apapun di Vault... (Email, Nama, Note)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <button 
            onClick={() => setCommandOpen(false)}
            className="p-2 text-text-muted hover:text-text-primary bg-black/5 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-8 text-center text-text-muted text-sm flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Membongkar Kubah Enkripsi...
          </div>
        )}

        {/* Results */}
        {!loading && (
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
            {results.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                Tidak ada hasil yang cocok dengan '{query}'
              </div>
            ) : (
              results.map((item, idx) => {
                const isActive = idx === selectedIndex;
                const email = item.decrypted?.mainAccount?.username || '';
                const password = item.decrypted?.mainAccount?.password || '';

                return (
                  <div 
                    key={item.id} 
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      isActive ? 'bg-primary/10 border border-primary/20 shadow-md' : 'border border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-lg bg-surface border border-border shadow-sm flex items-center justify-center shrink-0">
                        {getIcon(item.type)}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="font-semibold text-sm text-text-primary truncate">{item.name}</span>
                        {email && (
                          <span className="text-xs text-text-muted truncate flex items-center gap-1">
                            <Fingerprint size={10} className="text-cyan-500/70" /> {email}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 pl-4">
                      {email && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCopy(email, 'Email'); }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                            isActive ? 'bg-surface text-primary border border-primary/20 hover:bg-primary/20' : 'bg-transparent text-text-muted hover:bg-surface'
                          }`}
                        >
                          <Copy size={12} /> Email
                        </button>
                      )}
                      {password && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCopy(password, 'Password'); }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                            isActive ? 'bg-surface text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-transparent text-text-muted hover:bg-surface'
                          }`}
                        >
                          <Copy size={12} /> Pass
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        
        {/* Footer */}
        <div className="bg-surface border-t border-border p-3 flex items-center justify-between text-[10px] text-text-muted font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded border border-border">↑</kbd><kbd className="px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded border border-border">↓</kbd> Navigasi</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded border border-border">Enter</kbd> Salin Email</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded border border-border">Esc</kbd> Tutup</span>
          </div>
          <span>Pencarian Terenkripsi E2E</span>
        </div>

      </div>
    </div>
  );
};
