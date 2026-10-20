import React, { useRef, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
  Quote, Code, Minus, Undo2, Redo2, Maximize2, Minimize2,
  Highlighter, Palette, X, Sparkles, Loader2, ChevronDown, FileCode2,
  Copy, KeyRound
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { useVaultStore } from '../../store/vaultStore';
import { decryptData } from '../../utils/crypto';
import { API_URL } from '../../config';

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export const RichEditor: React.FC<RichEditorProps> = ({
  content,
  onChange,
  placeholder = 'Mulai menulis catatan di sini...',
  minHeight = '380px'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [stats, setStats] = useState({ words: 0, chars: 0 });
  const isUpdatingRef = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);
  const selectedTextRef = useRef('');
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { masterPassword } = useVaultStore();

  // ================= UNDO / REDO (history stack independen, bukan document.execCommand) =================
  // Kenapa custom? execCommand('undo'/'redo') deprecated & tidak selalu sinkron dengan state React (onChange).
  // Dengan history stack sendiri, setiap undo/redo dipastikan ikut memanggil onChange agar parent state selalu konsisten.
  const historyRef = useRef<{ stack: string[]; index: number }>({ stack: [content || ''], index: 0 });
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateUndoRedoFlags = () => {
    setCanUndo(historyRef.current.index > 0);
    setCanRedo(historyRef.current.index < historyRef.current.stack.length - 1);
  };

  const pushHistory = (html: string) => {
    const h = historyRef.current;
    if (h.stack[h.index] === html) return;
    const trimmed = h.stack.slice(0, h.index + 1);
    trimmed.push(html);
    if (trimmed.length > 100) trimmed.shift();
    historyRef.current = { stack: trimmed, index: trimmed.length - 1 };
    updateUndoRedoFlags();
  };

  const applyHistoryHtml = (html: string) => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = html;
    isUpdatingRef.current = true;
    onChange(html);
    updateStats();
    setTimeout(() => { isUpdatingRef.current = false; }, 50);
  };

  const undo = () => {
    if (historyTimerRef.current) { clearTimeout(historyTimerRef.current); historyTimerRef.current = null; }
    // Simpan dulu perubahan yang belum ter-checkpoint (debounce belum sempat jalan) sebelum mundur
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      if (currentHtml !== historyRef.current.stack[historyRef.current.index]) {
        pushHistory(currentHtml);
      }
    }
    const h = historyRef.current;
    if (h.index <= 0) { updateUndoRedoFlags(); return; }
    h.index -= 1;
    applyHistoryHtml(h.stack[h.index]);
    updateUndoRedoFlags();
  };

  const redo = () => {
    if (historyTimerRef.current) { clearTimeout(historyTimerRef.current); historyTimerRef.current = null; }
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) { updateUndoRedoFlags(); return; }
    h.index += 1;
    applyHistoryHtml(h.stack[h.index]);
    updateUndoRedoFlags();
  };

  // ================= MARKDOWN MODE =================
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [markdownText, setMarkdownText] = useState('');
  const turndownRef = useRef<TurndownService | null>(null);
  if (!turndownRef.current) {
    turndownRef.current = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    // Jaga elemen custom/kompleks tetap sebagai HTML mentah agar round-trip MD <-> WYSIWYG
    // tidak merusak checklist, highlight warna, underline, maupun tabel.
    turndownRef.current.keep((node: any) => {
      if (!node || !node.nodeName) return false;
      const tag = node.nodeName;
      if (tag === 'U') return true;
      if (['TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH'].includes(tag)) return true;
      if (node.classList && typeof node.classList.contains === 'function' && node.classList.contains('rk-task-item')) return true;
      if (node.getAttribute && node.getAttribute('style')) return true;
      if (tag === 'FONT') return true;
      return false;
    });
  }

  // ================= VAULT CREDENTIAL AUTO-LINK =================
  // Cache daftar kredensial (url + username + password) dari Kubah agar link yang
  // disisipkan di catatan bisa langsung "nyambung" ke kredensial yang cocok saat diklik.
  const vaultCredsRef = useRef<{ title: string; url: string; username: string; password: string }[] | null>(null);
  const [linkPopup, setLinkPopup] = useState<{
    x: number; y: number; url: string; loading: boolean;
    cred: { title: string; username: string; password: string } | null;
  } | null>(null);

  useEffect(() => {
    // Master password berubah (vault baru dibuka/ditutup) -> cache harus dimuat ulang
    vaultCredsRef.current = null;
  }, [masterPassword]);

  useEffect(() => {
    if (!linkPopup) return;
    const closeOnOutsideClick = (ev: MouseEvent) => {
      const popupEl = document.getElementById('rk-link-popup');
      if (popupEl && popupEl.contains(ev.target as Node)) return;
      setLinkPopup(null);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [linkPopup]);

  const loadVaultCredentials = async () => {
    if (vaultCredsRef.current) return vaultCredsRef.current;
    if (!masterPassword) { vaultCredsRef.current = []; return []; }
    try {
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      const list: { title: string; url: string; username: string; password: string }[] = [];
      if (res.data.success) {
        for (const item of res.data.data) {
          if (item.type !== 'password') continue;
          try {
            const dec = JSON.parse(await decryptData(item.encryptedData, masterPassword));
            const url = dec.url || '';
            const username = dec.mainAccount?.username || dec.username || '';
            const password = dec.mainAccount?.password || dec.password || '';
            if (url && (username || password)) {
              list.push({ title: item.title, url, username, password });
            }
          } catch {
            // skip item gagal didekripsi
          }
        }
      }
      vaultCredsRef.current = list;
      return list;
    } catch {
      vaultCredsRef.current = [];
      return [];
    }
  };

  // Normalisasi domain: buang protokol & "www." biar "https://www.google.com" == "google.com"
  const extractHost = (raw: string): string => {
    try {
      let u = raw.trim();
      if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
      return new URL(u).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return raw.trim().toLowerCase().replace(/^www\./, '');
    }
  };

  const findMatchingCredential = async (url: string) => {
    const creds = await loadVaultCredentials();
    const host = extractHost(url);
    if (!host) return null;
    return creds.find(c => extractHost(c.url) === host) || null;
  };

  // Sync content into contentEditable if changed externally
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content || '';
        updateStats();
        historyRef.current = { stack: [content || ''], index: 0 };
        updateUndoRedoFlags();
      }
    }
  }, [content]);

  // Track selected text inside editor for link prefill
  useEffect(() => {
    const onSelChange = () => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && editorRef.current && sel.anchorNode && editorRef.current.contains(sel.anchorNode)) {
        selectedTextRef.current = sel.toString();
      }
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, []);

  const updateStats = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    setStats({ words, chars });
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    isUpdatingRef.current = true;
    const html = editorRef.current.innerHTML;
    onChange(html);
    updateStats();
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 50);

    // Checkpoint history (debounced) — biar tidak push setiap keystroke, tapi tetap selalu sinkron dengan onChange
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      pushHistory(html);
    }, 400);
  };

  // Helper to save selection
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      if (editorRef.current.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    }
  };

  // Helper to restore selection
  const restoreSelection = () => {
    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(savedRangeRef.current);
      }
    }
  };

  const exec = (command: string, value: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    handleInput();
  };

  // Format block (H1, H2, H3, p, blockquote, pre)
  const formatBlock = (tag: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    try {
      document.execCommand('formatBlock', false, tag);
    } catch {
      // Fallback without angle brackets for older/varied browser engines
      document.execCommand('formatBlock', false, tag.replace(/[<>]/g, ''));
    }
    handleInput();
  };

  // Inline code if text selected, or code block if not
  const insertCode = () => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
      const selected = sel.toString();
      document.execCommand('insertHTML', false, `<code>${selected}</code>`);
      handleInput();
    } else {
      formatBlock('<pre>');
    }
  };

  // Insert Checklist item
  const insertChecklist = () => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    const sel = window.getSelection();
    const text = sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode) 
      ? sel.toString() 
      : 'Tugas baru';
    const checkboxHtml = `<div class="rk-task-item" data-checked="false"><span class="rk-checkbox" data-checked="false" contenteditable="false"></span><span class="rk-task-text">${text}</span></div><p><br/></p>`;
    document.execCommand('insertHTML', false, checkboxHtml);
    handleInput();
  };

  // Toggle checklist item on click (persistent via data-checked attr)
  // + Klik Link: tampilkan popup "lompat ke sumber" lengkap kredensial Vault yang cocok (jika ada)
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    const checkbox = target.closest('.rk-checkbox');
    if (checkbox && editorRef.current) {
      const taskItem = checkbox.closest('.rk-task-item') as HTMLElement | null;
      if (taskItem) {
        const nextChecked = checkbox.getAttribute('data-checked') !== 'true';
        checkbox.setAttribute('data-checked', String(nextChecked));
        taskItem.setAttribute('data-checked', String(nextChecked));
        handleInput();
      }
      return;
    }

    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (anchor && editorRef.current?.contains(anchor)) {
      e.preventDefault();
      e.stopPropagation();
      const url = anchor.href;
      const rect = anchor.getBoundingClientRect();
      setLinkPopup({ x: rect.left, y: rect.bottom + 6, url, loading: true, cred: null });
      findMatchingCredential(url).then(match => {
        setLinkPopup(prev => (prev && prev.url === url)
          ? { ...prev, loading: false, cred: match ? { title: match.title, username: match.username, password: match.password } : null }
          : prev);
      });
    }
  };

  // Keyboard navigation & helpers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ctrl+Z / Ctrl+Y (dan Ctrl+Shift+Z) — pakai history stack custom, bukan browser-native undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }

    // Tab key: indent spaces instead of losing focus
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
      handleInput();
      return;
    }

    // Enter inside checklist: create new item or escape to paragraph
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const anchor = sel.anchorNode;
      const taskItem = anchor instanceof HTMLElement 
        ? anchor.closest('.rk-task-item') 
        : anchor?.parentElement?.closest('.rk-task-item');

      if (taskItem) {
        const taskText = taskItem.querySelector('.rk-task-text');
        const text = taskText?.textContent?.trim() || '';
        
        // If current item is empty, escape to normal paragraph
        if (!text) {
          e.preventDefault();
          const p = document.createElement('p');
          p.innerHTML = '<br/>';
          taskItem.parentNode?.replaceChild(p, taskItem);
          const range = document.createRange();
          range.setStart(p, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          handleInput();
          return;
        }

        // If item has content, create new checklist item below
        e.preventDefault();
        const newItem = document.createElement('div');
        newItem.className = 'rk-task-item';
        newItem.setAttribute('data-checked', 'false');
        newItem.innerHTML = '<span class="rk-checkbox" data-checked="false" contenteditable="false"></span><span class="rk-task-text"><br/></span>';
        
        if (taskItem.nextSibling) {
          taskItem.parentNode?.insertBefore(newItem, taskItem.nextSibling);
        } else {
          taskItem.parentNode?.appendChild(newItem);
        }

        const newTextSpan = newItem.querySelector('.rk-task-text');
        if (newTextSpan) {
          const range = document.createRange();
          range.setStart(newTextSpan, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        handleInput();
        return;
      }
    }
  };

  // Handle paste image directly from clipboard
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (loadEv) => {
            const dataUrl = loadEv.target?.result as string;
            insertImageTag(dataUrl);
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
  };

  const insertImageTag = (src: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    const imgHtml = `<div style="margin: 12px 0; text-align: center;"><img src="${src}" alt="Gambar Catatan" style="max-width: 100%; max-height: 480px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 20px rgba(0,0,0,0.4);" /></div><p><br/></p>`;
    document.execCommand('insertHTML', false, imgHtml);
    handleInput();
  };

  // Upload local image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEv) => {
      const dataUrl = loadEv.target?.result as string;
      insertImageTag(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Save selection before opening link modal
  const openLinkModal = () => {
    saveSelection();
    setLinkText(selectedTextRef.current);
    setLinkUrl('');
    setShowLinkModal(true);
  };

  // Insert Link
  const confirmLink = () => {
    if (!linkUrl.trim()) return;
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    const text = linkText.trim() || url;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.color = '#00f0ff';
    a.style.textDecoration = 'underline';
    a.textContent = text;
    a.appendChild(document.createTextNode('\u00a0'));

    // Restore caret/selection lost when modal opened
    if (editorRef.current) {
      editorRef.current.focus();
      const sel = window.getSelection();
      if (savedRangeRef.current) {
        sel?.removeAllRanges();
        sel?.addRange(savedRangeRef.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(a);
      // Move caret after inserted link
      const after = document.createRange();
      after.setStartAfter(a);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    } else {
      editorRef.current?.appendChild(a);
    }

    savedRangeRef.current = null;
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
    handleInput();
  };

  // Insert Table
  const insertTable = () => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 1px solid rgba(255,255,255,0.15);">
        <thead>
          <tr style="background: rgba(0,240,255,0.1);">
            <th style="border: 1px solid rgba(255,255,255,0.15); padding: 8px; text-align: left; font-weight: 700;">Kolom 1</th>
            <th style="border: 1px solid rgba(255,255,255,0.15); padding: 8px; text-align: left; font-weight: 700;">Kolom 2</th>
            <th style="border: 1px solid rgba(255,255,255,0.15); padding: 8px; text-align: left; font-weight: 700;">Kolom 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data 1</td>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data 2</td>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data 3</td>
          </tr>
          <tr>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data 4</td>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data 5</td>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data 6</td>
          </tr>
        </tbody>
      </table><p><br/></p>
    `;
    document.execCommand('insertHTML', false, tableHtml);
    handleInput();
  };

  // Color picker handling
  const applyTextColor = (c: string) => {
    restoreSelection();
    document.execCommand('foreColor', false, c);
    setShowColorPicker(false);
    handleInput();
  };

  const applyHighlightColor = (c: string) => {
    restoreSelection();
    if (!document.execCommand('hiliteColor', false, c)) {
      document.execCommand('backColor', false, c);
    }
    setShowHighlightPicker(false);
    handleInput();
  };

  const textColors = ['#ffffff', '#00f0ff', '#51cf66', '#ffea00', '#ff6b6b', '#cc5de8', '#ff922b', '#94a3b8'];
  const highlightColors = ['transparent', 'rgba(255,234,0,0.3)', 'rgba(0,240,255,0.25)', 'rgba(81,207,102,0.25)', 'rgba(255,107,107,0.25)', 'rgba(204,93,232,0.25)'];

  // ================= AI WRITING ASSISTANT =================
  // Ambil kunci API AI dari Kubah (Vault) terenkripsi. Pola sama dengan SmartNotepad.tsx.
  // Karena Ruang Kerja didesain bebas-login (tanpa buka Kubah dulu), fitur AI ini
  // butuh masterPassword tersedia di memori (vault sudah pernah dibuka sesi ini).
  const getAiKeys = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      let groqKey = '';
      let openRouterKey = '';

      if (res.data.success) {
        for (const item of res.data.data) {
          if (item.type === 'api' || item.type === 'api_key') {
            try {
              if (!masterPassword) continue;
              const dec = JSON.parse(await decryptData(item.encryptedData, masterPassword));
              let extractedKey = '';
              if (dec.keys && dec.keys.length > 0) {
                extractedKey = dec.keys[0];
              } else if (dec.accounts) {
                for (const acc of dec.accounts) {
                  if (acc.apis) {
                    for (const api of acc.apis) {
                      if (api.key && api.key.length > 5) {
                        extractedKey = api.key;
                        break;
                      }
                    }
                  }
                }
              }
              if (!extractedKey) continue;
              // Matching title fleksibel: cukup mengandung kata kunci "groq" atau "openrouter"
              // (case-insensitive), tidak perlu persis sama seperti nama item di Vault.
              const titleLower = (item.title || '').toLowerCase();
              if (!groqKey && titleLower.includes('groq')) groqKey = extractedKey;
              if (!openRouterKey && (titleLower.includes('openrouter') || titleLower.includes('open router'))) openRouterKey = extractedKey;
            } catch {
              // skip item gagal didekripsi
            }
          }
        }
      }
      return { groqKey, openRouterKey };
    } catch {
      return { groqKey: '', openRouterKey: '' };
    }
  };

  const callAi = async (systemPrompt: string, userText: string): Promise<string | null> => {
    if (!masterPassword) {
      toast.error('Buka Kubah (Vault) dulu untuk pakai Asisten AI — kunci API tersimpan di sana.');
      return null;
    }
    const keys = await getAiKeys();
    const apiKey = keys.groqKey || keys.openRouterKey;
    if (!apiKey) {
      toast.error('Kunci API Groq/OpenRouter belum dikonfigurasi di menu Kunci API.');
      return null;
    }
    try {
      const useGroq = !!keys.groqKey;
      const url = useGroq
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';
      const model = useGroq ? 'llama-3.3-70b-versatile' : 'google/gemini-1.5-flash';

      const res = await axios.post(
        url,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
          temperature: 0.7,
        },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      return res.data?.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      console.error('AI request gagal:', err);
      toast.error('Gagal menghubungi AI. Cek kunci API atau koneksi internet.');
      return null;
    }
  };

  /** Ambil teks yang dipakai sebagai konteks: selection kalau ada, atau seluruh isi editor. */
  const getContextText = (): { text: string; isSelection: boolean } => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
      return { text: sel.toString(), isSelection: true };
    }
    return { text: editorRef.current?.innerText || '', isSelection: false };
  };

  const insertAiResult = (resultText: string, isSelection: boolean) => {
    if (editorRef.current) editorRef.current.focus();
    const html = `<p>${resultText.split('\n').join('<br/>')}</p>`;
    if (isSelection) {
      document.execCommand('insertHTML', false, html);
    } else {
      document.execCommand('selectAll', false);
      document.execCommand('insertHTML', false, html);
    }
    handleInput();
  };

  const runAiAction = async (action: 'continue' | 'summarize' | 'grammar') => {
    const { text, isSelection } = getContextText();
    if (!text.trim()) {
      toast.error('Tidak ada teks untuk diproses. Tulis dulu sesuatu, Bro.');
      return;
    }
    setShowAiMenu(false);
    setIsAiLoading(true);
    try {
      let systemPrompt = '';
      let userText = text;
      let useSelectionForInsert = isSelection;

      if (action === 'continue') {
        systemPrompt = 'Kamu asisten penulisan Bahasa Indonesia. Lanjutkan tulisan berikut dengan gaya & konteks yang konsisten, 2-4 kalimat baru saja, jangan ulangi teks aslinya. Balas HANYA kalimat lanjutannya.';
        // Untuk "lanjutkan", kita selalu sisipkan di akhir (bukan replace)
        useSelectionForInsert = true;
        if (editorRef.current) {
          editorRef.current.focus();
          document.execCommand('selectAll', false);
          document.getSelection()?.collapseToEnd();
        }
      } else if (action === 'summarize') {
        systemPrompt = 'Kamu asisten yang meringkas teks Bahasa Indonesia menjadi poin-poin singkat dan padat, maksimal 5 poin. Balas HANYA ringkasannya.';
      } else {
        systemPrompt = 'Kamu editor Bahasa Indonesia. Perbaiki tata bahasa, ejaan, dan kejelasan teks berikut TANPA mengubah makna aslinya. Balas HANYA versi perbaikannya, tanpa komentar tambahan.';
      }

      const result = await callAi(systemPrompt, userText);
      if (!result) return;

      if (action === 'continue') {
        // Sisipkan di posisi caret (akhir dokumen) sebagai lanjutan, bukan replace semua
        if (editorRef.current) editorRef.current.focus();
        document.execCommand('insertHTML', false, ` ${result}`);
        handleInput();
      } else {
        insertAiResult(result, useSelectionForInsert);
      }
      toast.success(
        action === 'continue' ? 'Tulisan dilanjutkan oleh AI!' :
        action === 'summarize' ? 'Ringkasan AI disisipkan!' :
        'Tata bahasa diperbaiki oleh AI!'
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  // ================= MARKDOWN MODE TOGGLE =================
  // Masuk mode Markdown: konversi HTML editor saat ini -> teks Markdown mentah.
  // Keluar mode Markdown: konversi teks Markdown -> HTML, lalu suntik balik ke editor.
  const toggleMarkdownMode = () => {
    if (!isMarkdownMode) {
      const html = editorRef.current?.innerHTML || content || '';
      const md = turndownRef.current!.turndown(html);
      setMarkdownText(md);
      setIsMarkdownMode(true);
    } else {
      const html = String(marked.parse(markdownText, { async: false }));
      if (editorRef.current) {
        editorRef.current.innerHTML = html;
      }
      isUpdatingRef.current = true;
      onChange(html);
      updateStats();
      setTimeout(() => { isUpdatingRef.current = false; }, 50);
      setIsMarkdownMode(false);
    }
  };

  const handleMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdownText(e.target.value);
  };

  const buttonClass = "p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/10 active:bg-white/15 transition-all text-xs flex items-center justify-center";

  // Prevent toolbar button click from stealing focus & clearing selection
  const preventFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className={`flex flex-col border border-border rounded-xl overflow-hidden bg-surface transition-all ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-bg-primary' : ''
    }`}>
      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-black/20 dark:bg-black/40 border-b border-border text-xs shrink-0 select-none">
        {/* Undo / Redo — history stack React sendiri, bukan document.execCommand (lihat catatan audit) */}
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={undo} 
          disabled={!canUndo}
          className={`${buttonClass} disabled:opacity-30 disabled:cursor-not-allowed`} 
          title="Urungkan (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={redo} 
          disabled={!canRedo}
          className={`${buttonClass} disabled:opacity-30 disabled:cursor-not-allowed`} 
          title="Ulangi (Ctrl+Y)"
        >
          <Redo2 size={15} />
        </button>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Headings */}
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => formatBlock('<h1>')} 
          className={buttonClass} 
          title="Judul Besar (H1)"
        >
          <Heading1 size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => formatBlock('<h2>')} 
          className={buttonClass} 
          title="Subjudul (H2)"
        >
          <Heading2 size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => formatBlock('<h3>')} 
          className={buttonClass} 
          title="Poin Kecil (H3)"
        >
          <Heading3 size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => formatBlock('<p>')} 
          className={buttonClass} 
          title="Paragraf Biasa"
        >
          <span className="font-semibold text-xs px-1">P</span>
        </button>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Inline Formatting */}
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => exec('bold')} 
          className={buttonClass} 
          title="Tebal (Ctrl+B)"
        >
          <Bold size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => exec('italic')} 
          className={buttonClass} 
          title="Miring (Ctrl+I)"
        >
          <Italic size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => exec('underline')} 
          className={buttonClass} 
          title="Garis Bawah (Ctrl+U)"
        >
          <UnderlineIcon size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => exec('strikeThrough')} 
          className={buttonClass} 
          title="Coret"
        >
          <Strikethrough size={15} />
        </button>

        {/* Text Color Picker */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => {
              preventFocusLoss(e);
              saveSelection();
            }}
            onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); }}
            className={buttonClass}
            title="Warna Teks"
          >
            <Palette size={15} />
          </button>
          {showColorPicker && (
            <div className="absolute top-8 left-0 z-50 p-2 bg-surface border border-border rounded-xl shadow-2xl flex gap-1.5 backdrop-blur-xl">
              {textColors.map(c => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => applyTextColor(c)}
                  style={{ backgroundColor: c }}
                  className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
                />
              ))}
            </div>
          )}
        </div>

        {/* Highlight Color Picker */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => {
              preventFocusLoss(e);
              saveSelection();
            }}
            onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); }}
            className={buttonClass}
            title="Sorot Warna (Stabilo)"
          >
            <Highlighter size={15} />
          </button>
          {showHighlightPicker && (
            <div className="absolute top-8 left-0 z-50 p-2 bg-surface border border-border rounded-xl shadow-2xl flex gap-1.5 backdrop-blur-xl">
              {highlightColors.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => applyHighlightColor(c)}
                  style={{ backgroundColor: c === 'transparent' ? '#333' : c }}
                  className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform flex items-center justify-center text-[10px]"
                >
                  {c === 'transparent' ? '✕' : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Lists & Checklists */}
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => exec('insertUnorderedList')} 
          className={buttonClass} 
          title="Bullet List"
        >
          <List size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => exec('insertOrderedList')} 
          className={buttonClass} 
          title="Numbered List"
        >
          <ListOrdered size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={insertChecklist} 
          className={buttonClass} 
          title="Checklist / Task"
        >
          <CheckSquare size={15} />
        </button>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Quote & Code */}
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => formatBlock('<blockquote>')} 
          className={buttonClass} 
          title="Kutipan (Quote)"
        >
          <Quote size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={insertCode} 
          className={buttonClass} 
          title="Kode (Inline atau Blok)"
        >
          <Code size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => exec('insertHorizontalRule')} 
          className={buttonClass} 
          title="Garis Pemisah"
        >
          <Minus size={15} />
        </button>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Insert Elements */}
        <button 
          type="button" 
          onMouseDown={(e) => {
            preventFocusLoss(e);
            saveSelection();
          }} 
          onClick={openLinkModal} 
          className={buttonClass} 
          title="Sisipkan Link"
        >
          <LinkIcon size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={() => fileInputRef.current?.click()} 
          className={buttonClass} 
          title="Upload Foto/Gambar (Bisa juga langsung Paste Gambar!)"
        >
          <ImageIcon size={15} />
        </button>
        <button 
          type="button" 
          onMouseDown={preventFocusLoss} 
          onClick={insertTable} 
          className={buttonClass} 
          title="Sisipkan Tabel"
        >
          <TableIcon size={15} />
        </button>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* AI Writing Assistant */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => setShowAiMenu(!showAiMenu)}
            disabled={isAiLoading}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isAiLoading
                ? 'text-text-muted opacity-60 cursor-wait'
                : 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10'
            }`}
            title="Asisten Penulisan AI"
          >
            {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span className="hidden sm:inline">Asisten AI</span>
            <ChevronDown size={12} />
          </button>
          {showAiMenu && (
            <div className="absolute top-8 left-0 z-50 w-56 p-1.5 bg-surface border border-border rounded-xl shadow-2xl backdrop-blur-xl flex flex-col gap-0.5">
              <button
                type="button"
                onMouseDown={preventFocusLoss}
                onClick={() => runAiAction('continue')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-text-primary hover:bg-violet-500/10 text-left"
              >
                <Sparkles size={13} className="text-violet-400" /> Lanjutkan Tulisan
              </button>
              <button
                type="button"
                onMouseDown={preventFocusLoss}
                onClick={() => runAiAction('summarize')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-text-primary hover:bg-violet-500/10 text-left"
              >
                <Sparkles size={13} className="text-violet-400" /> Ringkas Teks
              </button>
              <button
                type="button"
                onMouseDown={preventFocusLoss}
                onClick={() => runAiAction('grammar')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-text-primary hover:bg-violet-500/10 text-left"
              >
                <Sparkles size={13} className="text-violet-400" /> Perbaiki Tata Bahasa
              </button>
              <p className="px-3 pt-1 pb-0.5 text-[10px] text-text-muted border-t border-border/50 mt-0.5">
                Pakai teks terpilih, atau seluruh isi jika tidak ada seleksi.
              </p>
            </div>
          )}
        </div>

        {/* Right side tools */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-text-muted hidden sm:inline">
            {stats.words} kata · {stats.chars} karakter
          </span>
          <button
            type="button"
            onClick={toggleMarkdownMode}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isMarkdownMode
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-text-muted hover:text-text-primary hover:bg-white/10'
            }`}
            title={isMarkdownMode ? 'Kembali ke Mode Tulis (WYSIWYG)' : 'Mode Markdown Mentah'}
          >
            <FileCode2 size={14} />
            <span className="hidden sm:inline">{isMarkdownMode ? 'Markdown' : 'MD'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={buttonClass}
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Link Insert Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-text-primary flex items-center gap-2">
                <LinkIcon size={16} className="text-cyan-400" /> Sisipkan Link URL
              </h4>
              <button onClick={() => setShowLinkModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Teks link (opsional)"
                value={linkText}
                onChange={e => setLinkText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmLink()}
                className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
              />
              <input
                type="text"
                placeholder="https://contoh.com..."
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmLink()}
                className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-text-muted hover:bg-white/5"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmLink}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500 text-black hover:bg-cyan-400"
              >
                Sisipkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link "Lompat ke Sumber" Popup — klik link di catatan untuk buka URL + lihat kredensial Vault yang cocok */}
      {linkPopup && (
        <div
          id="rk-link-popup"
          style={{ position: 'fixed', left: linkPopup.x, top: linkPopup.y, zIndex: 60 }}
          className="w-72 p-3 bg-surface border border-border rounded-xl shadow-2xl backdrop-blur-xl space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-text-muted truncate flex-1" title={linkPopup.url}>{linkPopup.url}</p>
            <button
              type="button"
              onClick={() => setLinkPopup(null)}
              className="text-text-muted hover:text-text-primary shrink-0"
            >
              <X size={13} />
            </button>
          </div>

          <a
            href={linkPopup.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setLinkPopup(null)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-black hover:bg-cyan-400 transition-all"
          >
            <LinkIcon size={13} /> Buka Sumber
          </a>

          {linkPopup.loading ? (
            <div className="flex items-center justify-center gap-1.5 py-2 text-[11px] text-text-muted">
              <Loader2 size={12} className="animate-spin" /> Mencari kredensial di Kubah...
            </div>
          ) : linkPopup.cred ? (
            <div className="pt-2 border-t border-border/60 space-y-1.5">
              <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <KeyRound size={11} /> Kredensial ditemukan: {linkPopup.cred.title}
              </p>
              {linkPopup.cred.username && (
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(linkPopup.cred!.username); toast.success('Email/username disalin!'); }}
                  className="flex items-center justify-between gap-2 w-full px-2.5 py-1.5 rounded-lg bg-black/20 border border-border text-[11px] text-text-primary hover:border-cyan-400 transition-all"
                >
                  <span className="truncate">{linkPopup.cred.username}</span>
                  <Copy size={12} className="shrink-0 text-text-muted" />
                </button>
              )}
              {linkPopup.cred.password && (
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(linkPopup.cred!.password); toast.success('Kata sandi disalin!'); }}
                  className="flex items-center justify-between gap-2 w-full px-2.5 py-1.5 rounded-lg bg-black/20 border border-border text-[11px] text-text-primary hover:border-cyan-400 transition-all"
                >
                  <span className="truncate">••••••••••</span>
                  <Copy size={12} className="shrink-0 text-text-muted" />
                </button>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-text-muted pt-1 border-t border-border/60">
              {masterPassword ? 'Tidak ada kredensial tersimpan di Kubah untuk domain ini.' : 'Buka Kubah (Vault) dulu untuk cek kredensial otomatis.'}
            </p>
          )}
        </div>
      )}

      {/* Editable Canvas (WYSIWYG) — tetap mounted saat mode Markdown aktif agar innerHTML bisa dibaca saat toggle kembali */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onClick={handleEditorClick}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        style={{ minHeight: isFullscreen ? 'calc(100vh - 80px)' : minHeight, display: isMarkdownMode ? 'none' : undefined }}
        className="flex-1 p-5 outline-none overflow-y-auto text-sm leading-relaxed text-text-primary focus:outline-none rk-editor-body"
      />

      {/* Markdown Raw Mode */}
      {isMarkdownMode && (
        <textarea
          value={markdownText}
          onChange={handleMarkdownChange}
          placeholder={'# Judul\n\nTulis dalam format Markdown mentah di sini...'}
          style={{ minHeight: isFullscreen ? 'calc(100vh - 80px)' : minHeight }}
          className="flex-1 p-5 outline-none resize-none bg-black/10 text-sm leading-relaxed text-text-primary font-mono focus:outline-none"
          spellCheck={false}
        />
      )}
    </div>
  );
};
