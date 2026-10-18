import React, { useRef, useState, useEffect } from 'react';
import {
  Paintbrush, Eraser, Trash2, Download, Undo2, Check, Plus, Pencil, X,
  Minus as LineIcon, Square, Circle as CircleIcon, ArrowRight, Layers
} from 'lucide-react';
import { wsStorage, type DrawingBoard } from '../../services/workspaceStorage';
import toast from 'react-hot-toast';

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'circle' | 'arrow';

export const DrawingPanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState('#00f0ff');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<Tool>('pen');
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const shapeStartPos = useRef<{ x: number; y: number } | null>(null);
  const preShapeSnapshotRef = useRef<ImageData | null>(null);
  const historyRef = useRef<string[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===== Multi-Board (Tier 2 Fitur A) =====
  const [boards, setBoards] = useState<DrawingBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [boardCreating, setBoardCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const colors = ['#00f0ff', '#ff6b6b', '#51cf66', '#ffea00', '#cc5de8', '#ff922b', '#ffffff', '#888888'];
  const isEraser = tool === 'eraser';
  const isShapeTool = tool === 'line' || tool === 'rect' || tool === 'circle' || tool === 'arrow';

  // Load list papan saat mount, lalu buka papan aktif pertama
  useEffect(() => {
    wsStorage.getDrawingBoards().then(list => {
      setBoards(list);
      if (list.length > 0) setActiveBoardId(list[0].id);
    });
  }, []);

  // Setiap kali papan aktif berganti, render ulang isi kanvas papan itu
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || activeBoardId === null) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const board = boards.find(b => b.id === activeBoardId);
    historyRef.current = [];

    if (board?.data) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        saveHistorySnapshot();
      };
      img.src = board.data;
    } else {
      saveHistorySnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardId]);

  const saveHistorySnapshot = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    historyRef.current = [...historyRef.current.slice(-14), dataUrl];
  };

  const autoSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (canvasRef.current && activeBoardId !== null) {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        wsStorage.saveDrawingBoardData(activeBoardId, dataUrl);
        setBoards(prev => prev.map(b => b.id === activeBoardId ? { ...b, data: dataUrl } : b));
      }
    }, 1000);
  };

  // ===== Board management handlers =====
  const handleAddBoard = async () => {
    const name = newBoardName.trim() || `Papan ${boards.length + 1}`;
    const newBoard = await wsStorage.addDrawingBoard(name);
    setBoards(prev => [...prev, newBoard]);
    setActiveBoardId(newBoard.id);
    setBoardCreating(false);
    setNewBoardName('');
    toast.success(`Papan "${name}" dibuat`);
  };

  const startRename = (b: DrawingBoard) => {
    setRenamingId(b.id);
    setRenameValue(b.name);
  };

  const confirmRename = async () => {
    if (renamingId === null) return;
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    await wsStorage.renameDrawingBoard(renamingId, name);
    setBoards(prev => prev.map(b => b.id === renamingId ? { ...b, name } : b));
    setRenamingId(null);
  };

  const handleDeleteBoard = async (id: number) => {
    if (boards.length <= 1) {
      toast.error('Minimal harus ada 1 papan gambar');
      return;
    }
    if (!window.confirm('Hapus papan gambar ini beserta semua isinya?')) return;
    await wsStorage.deleteDrawingBoard(id);
    const remaining = boards.filter(b => b.id !== id);
    setBoards(remaining);
    if (activeBoardId === id) setActiveBoardId(remaining[0].id);
    toast.success('Papan gambar dihapus');
  };

  // ===== Coordinate helpers =====
  const getPosFromClient = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => getPosFromClient(e.clientX, e.clientY);

  const getPosFromTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return { x: 0, y: 0 };
    return getPosFromClient(touch.clientX, touch.clientY);
  };

  // ===== Freehand pen/eraser =====
  const strokeTo = (pos: { x: number; y: number }) => {
    if (!canvasRef.current || !lastPos.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    // Eraser sungguhan: hapus piksel transparan, bukan gambar warna gelap di atasnya
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = isEraser ? brushSize * 4 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    lastPos.current = pos;
  };

  // ===== Shape tools (Tier 2 Fitur B): garis, kotak, lingkaran, panah =====
  const drawArrowHead = (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const headLength = Math.max(10, brushSize * 4);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const drawShapePreview = (pos: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas || !shapeStartPos.current || !preShapeSnapshotRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Kembalikan kanvas ke kondisi sebelum preview, baru gambar bentuk baru di atasnya
    ctx.putImageData(preShapeSnapshotRef.current, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const start = shapeStartPos.current;
    if (tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (tool === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      drawArrowHead(ctx, start, pos);
    } else if (tool === 'rect') {
      ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
    } else if (tool === 'circle') {
      const rx = Math.abs(pos.x - start.x) / 2;
      const ry = Math.abs(pos.y - start.y) / 2;
      const cx = (start.x + pos.x) / 2;
      const cy = (start.y + pos.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  // ===== Mouse handlers =====
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    setDrawing(true);
    if (isShapeTool) {
      shapeStartPos.current = pos;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        preShapeSnapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    } else {
      lastPos.current = pos;
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const pos = getPos(e);
    if (isShapeTool) {
      drawShapePreview(pos);
    } else {
      strokeTo(pos);
    }
  };

  // ===== Touch handlers (mobile/tablet) =====
  const startDrawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getPosFromTouch(e);
    setDrawing(true);
    if (isShapeTool) {
      shapeStartPos.current = pos;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        preShapeSnapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    } else {
      lastPos.current = pos;
    }
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPosFromTouch(e);
    if (isShapeTool) {
      drawShapePreview(pos);
    } else {
      strokeTo(pos);
    }
  };

  const stopDraw = () => {
    if (drawing) {
      setDrawing(false);
      lastPos.current = null;
      shapeStartPos.current = null;
      preShapeSnapshotRef.current = null;
      saveHistorySnapshot();
      autoSave();
    }
  };

  const handleUndo = () => {
    if (historyRef.current.length <= 1) {
      toast.error('Tidak ada coretan sebelumnya');
      return;
    }
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      autoSave();
    };
    img.src = prev;
    toast.success('Urungkan coretan');
  };

  const clearCanvas = () => {
    if (!window.confirm('Hapus semua coretan di papan gambar ini?')) return;
    if (!canvasRef.current || activeBoardId === null) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    saveHistorySnapshot();
    wsStorage.clearDrawingBoardData(activeBoardId);
    setBoards(prev => prev.map(b => b.id === activeBoardId ? { ...b, data: null } : b));
    toast.success('Papan gambar dibersihkan');
  };

  const downloadPNG = () => {
    if (!canvasRef.current) return;
    const activeBoard = boards.find(b => b.id === activeBoardId);
    const a = document.createElement('a');
    a.download = `gambar-vaultpro-${(activeBoard?.name || 'papan').replace(/\s+/g, '-')}-${Date.now()}.png`;
    a.href = canvasRef.current.toDataURL('image/png');
    a.click();
    toast.success('Gambar PNG berhasil diunduh');
  };

  const toolButtonClass = (active: boolean, activeColorClass: string) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
      active ? activeColorClass : 'text-text-muted hover:text-text-primary'
    }`;

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-140px)]">
      {/* Board Tabs (Multi-Kanvas) */}
      <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-surface border border-border rounded-2xl shrink-0">
        <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-text-muted px-1">
          <Layers size={13} className="text-cyan-400" />
        </div>
        {boards.map(b => (
          renamingId === b.id ? (
            <div key={b.id} className="flex items-center gap-1">
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenamingId(null); }}
                className="w-28 px-2 py-1 bg-black/20 border border-cyan-500/40 rounded-lg text-xs text-text-primary outline-none"
              />
              <button onClick={confirmRename} className="p-1 rounded-lg bg-cyan-500 text-black"><Check size={12} /></button>
            </div>
          ) : (
            <div
              key={b.id}
              className={`group flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                activeBoardId === b.id
                  ? 'bg-cyan-500 text-black border-cyan-500'
                  : 'bg-black/20 text-text-muted border-border hover:text-text-primary'
              }`}
              onClick={() => setActiveBoardId(b.id)}
            >
              {b.name}
              <button
                onClick={(e) => { e.stopPropagation(); startRename(b); }}
                className={`opacity-0 group-hover:opacity-100 transition-opacity ${activeBoardId === b.id ? 'text-black/70 hover:text-black' : 'text-text-muted hover:text-cyan-400'}`}
                title="Ganti nama papan"
              >
                <Pencil size={11} />
              </button>
              {boards.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteBoard(b.id); }}
                  className={`opacity-0 group-hover:opacity-100 transition-opacity ${activeBoardId === b.id ? 'text-black/70 hover:text-black' : 'text-text-muted hover:text-rose-400'}`}
                  title="Hapus papan"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )
        ))}

        {boardCreating ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newBoardName}
              onChange={e => setNewBoardName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddBoard(); if (e.key === 'Escape') setBoardCreating(false); }}
              placeholder={`Papan ${boards.length + 1}`}
              className="w-28 px-2 py-1 bg-black/20 border border-cyan-500/40 rounded-lg text-xs text-text-primary outline-none"
            />
            <button onClick={handleAddBoard} className="p-1 rounded-lg bg-cyan-500 text-black"><Check size={12} /></button>
            <button onClick={() => setBoardCreating(false)} className="p-1 rounded-lg bg-black/20 text-text-muted"><X size={12} /></button>
          </div>
        ) : (
          <button
            onClick={() => { setBoardCreating(true); setNewBoardName(''); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold hover:bg-cyan-500/20 transition-all"
          >
            <Plus size={13} /> Papan Baru
          </button>
        )}
      </div>

      {/* Toolbar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-border rounded-2xl shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode: Pen / Eraser / Shapes */}
          <div className="flex bg-black/30 p-1 rounded-xl border border-border">
            <button onClick={() => setTool('pen')} className={toolButtonClass(tool === 'pen', 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30')} title="Kuas Bebas">
              <Paintbrush size={14} /> <span className="hidden sm:inline">Kuas</span>
            </button>
            <button onClick={() => setTool('eraser')} className={toolButtonClass(tool === 'eraser', 'bg-rose-500/20 text-rose-400 border border-rose-500/30')} title="Penghapus">
              <Eraser size={14} /> <span className="hidden sm:inline">Hapus</span>
            </button>
            <button onClick={() => setTool('line')} className={toolButtonClass(tool === 'line', 'bg-amber-500/20 text-amber-400 border border-amber-500/30')} title="Garis Lurus">
              <LineIcon size={14} />
            </button>
            <button onClick={() => setTool('arrow')} className={toolButtonClass(tool === 'arrow', 'bg-amber-500/20 text-amber-400 border border-amber-500/30')} title="Panah">
              <ArrowRight size={14} />
            </button>
            <button onClick={() => setTool('rect')} className={toolButtonClass(tool === 'rect', 'bg-amber-500/20 text-amber-400 border border-amber-500/30')} title="Persegi">
              <Square size={14} />
            </button>
            <button onClick={() => setTool('circle')} className={toolButtonClass(tool === 'circle', 'bg-amber-500/20 text-amber-400 border border-amber-500/30')} title="Lingkaran/Elips">
              <CircleIcon size={14} />
            </button>
          </div>

          {/* Color palette */}
          {!isEraser && (
            <div className="flex items-center gap-1.5 border-l border-border pl-3">
              {colors.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full border transition-all ${
                    color === c ? 'scale-125 border-white ring-2 ring-cyan-400/50' : 'border-white/20 opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Brush thickness slider */}
          <div className="flex items-center gap-2 border-l border-border pl-3 text-xs text-text-muted">
            <span>Tebal:</span>
            <input
              type="range"
              min="1"
              max="24"
              value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
              className="w-20 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono text-cyan-400 w-8">{brushSize}px</span>
          </div>
        </div>

        {/* Right action buttons: Undo, Clear, Save PNG */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-white/5 border border-border transition-all"
            title="Urungkan Coretan Terakhir"
          >
            <Undo2 size={14} /> <span className="hidden sm:inline">Urungkan</span>
          </button>

          <button
            onClick={clearCanvas}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-border hover:border-rose-500/30 transition-all"
            title="Bersihkan Papan Ini"
          >
            <Trash2 size={14} /> <span className="hidden sm:inline">Hapus Semua</span>
          </button>

          <button
            onClick={downloadPNG}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 shadow-md shadow-cyan-500/20 transition-all"
          >
            <Download size={14} /> Simpan PNG
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 bg-slate-950/80 border border-border rounded-2xl overflow-hidden relative cursor-crosshair shadow-inner">
        <canvas
          ref={canvasRef}
          width={1600}
          height={900}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDrawTouch}
          onTouchMove={drawTouch}
          onTouchEnd={stopDraw}
          onTouchCancel={stopDraw}
          className="w-full h-full block touch-none"
        />
        <div className="absolute bottom-3 right-3 text-[10px] text-text-muted/40 pointer-events-none uppercase tracking-widest font-mono">
          Auto-Saved Whiteboard · 1600x900 Canvas · {boards.find(b => b.id === activeBoardId)?.name || ''}
        </div>
      </div>
    </div>
  );
};
