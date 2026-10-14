import React, { useRef, useState, useEffect } from 'react';
import { Paintbrush, Eraser, Trash2, Download, Undo2, Check } from 'lucide-react';
import { wsStorage } from '../../services/workspaceStorage';
import toast from 'react-hot-toast';

export const DrawingPanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState('#00f0ff');
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<string[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colors = ['#00f0ff', '#ff6b6b', '#51cf66', '#ffea00', '#cc5de8', '#ff922b', '#ffffff', '#888888'];

  // Load saved canvas drawing on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    wsStorage.getCanvasDrawing().then(savedData => {
      if (savedData) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          saveHistorySnapshot();
        };
        img.src = savedData;
      } else {
        saveHistorySnapshot();
      }
    });
  }, []);

  const saveHistorySnapshot = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    historyRef.current = [...historyRef.current.slice(-14), dataUrl];
  };

  const autoSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (canvasRef.current) {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        wsStorage.saveCanvasDrawing(dataUrl);
      }
    }, 1000);
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !canvasRef.current || !lastPos.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = isEraser ? '#0f172a' : color;
    ctx.lineWidth = isEraser ? brushSize * 4 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPos.current = pos;
  };

  const stopDraw = () => {
    if (drawing) {
      setDrawing(false);
      lastPos.current = null;
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
    if (!window.confirm('Hapus semua coretan di papan gambar?')) return;
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    saveHistorySnapshot();
    wsStorage.clearCanvasDrawing();
    toast.success('Papan gambar dibersihkan');
  };

  const downloadPNG = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.download = `gambar-vaultpro-${Date.now()}.png`;
    a.href = canvasRef.current.toDataURL('image/png');
    a.click();
    toast.success('Gambar PNG berhasil diunduh');
  };

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-140px)]">
      {/* Toolbar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-border rounded-2xl shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Pen / Eraser */}
          <div className="flex bg-black/30 p-1 rounded-xl border border-border">
            <button
              onClick={() => setIsEraser(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !isEraser ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Paintbrush size={14} /> Kuas
            </button>
            <button
              onClick={() => setIsEraser(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isEraser ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Eraser size={14} /> Penghapus
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
            title="Bersihkan Semua Papan"
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
          className="w-full h-full block"
        />
        <div className="absolute bottom-3 right-3 text-[10px] text-text-muted/40 pointer-events-none uppercase tracking-widest font-mono">
          Auto-Saved Whiteboard · 1600x900 Canvas
        </div>
      </div>
    </div>
  );
};
