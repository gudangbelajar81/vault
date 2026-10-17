import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
  Quote, Code, Minus, Undo2, Redo2, Maximize2, Minimize2,
  Highlighter, Palette, UploadCloud, X
} from 'lucide-react';

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

  // Sync content into contentEditable if changed externally
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content || '';
        updateStats();
      }
    }
  }, [content]);

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
  };

  const exec = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  // Format block (H1, H2, H3, p, blockquote)
  const formatBlock = (tag: string) => {
    document.execCommand('formatBlock', false, tag);
    handleInput();
  };

  // Insert Checklist item
  const insertChecklist = () => {
    const checkboxHtml = '<div class="rk-task-item" data-checked="false"><span class="rk-checkbox" data-checked="false" contenteditable="false"></span><span class="rk-task-text">Tugas baru</span></div><p><br/></p>';
    document.execCommand('insertHTML', false, checkboxHtml);
    handleInput();
  };

  // Toggle checklist item on click (persistent via data-checked attr)
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const checkbox = target.closest('.rk-checkbox');
    if (!checkbox || !editorRef.current) return;
    const taskItem = checkbox.closest('.rk-task-item') as HTMLElement | null;
    if (!taskItem) return;
    const nextChecked = checkbox.getAttribute('data-checked') !== 'true';
    checkbox.setAttribute('data-checked', String(nextChecked));
    taskItem.setAttribute('data-checked', String(nextChecked));
    handleInput();
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
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      if (editorRef.current.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    }
    setShowLinkModal(true);
  };

  // Insert Link
  const confirmLink = () => {
    if (!linkUrl.trim()) return;
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    const text = linkText.trim() || url;
    const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #00f0ff; text-decoration: underline;">${text}</a> `;

    // Restore caret/selection lost when modal opened
    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(savedRangeRef.current);
      } else {
        // Fallback: caret at end
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }

    document.execCommand('insertHTML', false, linkHtml);
    savedRangeRef.current = null;
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
    handleInput();
  };

  // Insert Table
  const insertTable = () => {
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
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data A1</td>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data B1</td>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data C1</td>
          </tr>
          <tr>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data A2</td>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data B2</td>
            <td style="border: 1px solid rgba(255,255,255,0.1); padding: 8px;">Data C2</td>
          </tr>
        </tbody>
      </table><p><br/></p>
    `;
    document.execCommand('insertHTML', false, tableHtml);
    handleInput();
  };

  const textColors = ['#ffffff', '#00f0ff', '#51cf66', '#ffea00', '#ff6b6b', '#cc5de8', '#ff922b', '#94a3b8'];
  const highlightColors = ['transparent', 'rgba(255,234,0,0.3)', 'rgba(0,240,255,0.25)', 'rgba(81,207,102,0.25)', 'rgba(255,107,107,0.25)', 'rgba(204,93,232,0.25)'];

  const buttonClass = "p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/10 active:bg-white/15 transition-all text-xs flex items-center justify-center";

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
        {/* Undo / Redo */}
        <button type="button" onClick={() => exec('undo')} className={buttonClass} title="Urungkan (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button type="button" onClick={() => exec('redo')} className={buttonClass} title="Ulangi (Ctrl+Y)">
          <Redo2 size={15} />
        </button>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Headings */}
        <button type="button" onClick={() => formatBlock('<h1>')} className={buttonClass} title="Judul Besar (H1)">
          <Heading1 size={15} />
        </button>
        <button type="button" onClick={() => formatBlock('<h2>')} className={buttonClass} title="Subjudul (H2)">
          <Heading2 size={15} />
        </button>
        <button type="button" onClick={() => formatBlock('<h3>')} className={buttonClass} title="Poin Kecil (H3)">
          <Heading3 size={15} />
        </button>
        <button type="button" onClick={() => formatBlock('<p>')} className={buttonClass} title="Paragraf Biasa">
          <span className="font-semibold text-xs px-1">P</span>
        </button>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Inline Formatting */}
        <button type="button" onClick={() => exec('bold')} className={buttonClass} title="Tebal (Ctrl+B)">
          <Bold size={15} />
        </button>
        <button type="button" onClick={() => exec('italic')} className={buttonClass} title="Miring (Ctrl+I)">
          <Italic size={15} />
        </button>
        <button type="button" onClick={() => exec('underline')} className={buttonClass} title="Garis Bawah (Ctrl+U)">
          <UnderlineIcon size={15} />
        </button>
        <button type="button" onClick={() => exec('strikeThrough')} className={buttonClass} title="Coret">
          <Strikethrough size={15} />
        </button>

        {/* Text Color Picker */}
        <div className="relative">
          <button
            type="button"
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
                  onClick={() => { exec('foreColor', c); setShowColorPicker(false); }}
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
                  onClick={() => { exec('hiliteColor', c); setShowHighlightPicker(false); }}
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
        <button type="button" onClick={() => exec('insertUnorderedList')} className={buttonClass} title="Bullet List">
          <List size={15} />
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={buttonClass} title="Numbered List">
          <ListOrdered size={15} />
        </button>
        <button type="button" onClick={insertChecklist} className={buttonClass} title="Checklist / Task">
          <CheckSquare size={15} />
        </button>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Quote & Code */}
        <button type="button" onClick={() => formatBlock('<blockquote>')} className={buttonClass} title="Kutipan (Quote)">
          <Quote size={15} />
        </button>
        <button type="button" onClick={() => formatBlock('<pre>')} className={buttonClass} title="Kode Blok">
          <Code size={15} />
        </button>
        <button type="button" onClick={() => exec('insertHorizontalRule')} className={buttonClass} title="Garis Pemisah">
          <Minus size={15} />
        </button>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Insert Elements */}
        <button type="button" onClick={openLinkModal} className={buttonClass} title="Sisipkan Link">
          <LinkIcon size={15} />
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className={buttonClass} title="Upload Foto/Gambar (Bisa juga langsung Paste Gambar!)">
          <ImageIcon size={15} />
        </button>
        <button type="button" onClick={insertTable} className={buttonClass} title="Sisipkan Tabel">
          <TableIcon size={15} />
        </button>

        {/* Right side tools */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-text-muted hidden sm:inline">
            {stats.words} kata · {stats.chars} karakter
          </span>
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
                className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
              />
              <input
                type="text"
                placeholder="https://contoh.com..."
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-xs text-text-primary outline-none focus:border-cyan-400"
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

      {/* Editable Canvas */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onClick={handleEditorClick}
        data-placeholder={placeholder}
        style={{ minHeight: isFullscreen ? 'calc(100vh - 80px)' : minHeight }}
        className="flex-1 p-5 outline-none overflow-y-auto text-sm leading-relaxed text-text-primary focus:outline-none rk-editor-body"
      />
    </div>
  );
};
