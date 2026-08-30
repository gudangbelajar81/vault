import React, { useState, useEffect, useRef } from 'react';
import { Copy, Printer, Eraser, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';

type HistoryItem = { id: string; expression: string; result: number; note: string };

export const SmartCalculator: React.FC = () => {
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history from cache
  useEffect(() => {
    const saved = localStorage.getItem('smart_calc_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // Scroll to bottom when history changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Safe Math Evaluator using Function (BODMAS compliant)
  const evaluateMath = (expr: string): number => {
    // Sanitasi input: hanya izinkan angka, operator dasar, dan kurung
    const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
    if (!sanitized) return 0;
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + sanitized)();
      if (typeof result !== 'number' || !isFinite(result)) throw new Error('Invalid');
      return result;
    } catch {
      throw new Error('Format salah');
    }
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expression.trim()) return;

    try {
      // Ubah x ke * untuk evaluasi
      const toEval = expression.replace(/x/g, '*').replace(/,/g, '');
      const result = evaluateMath(toEval);
      
      const newHistory = [...history, {
        id: Date.now().toString(),
        expression: expression,
        result,
        note: ''
      }];
      setHistory(newHistory);
      localStorage.setItem('smart_calc_history', JSON.stringify(newHistory));
      setExpression(result.toString()); // Set result to input for chaining
    } catch (err) {
      toast.error('Format hitungan salah. Gunakan angka dan +, -, x, /');
    }
  };

  const updateNote = (id: string, note: string) => {
    const newH = history.map(h => h.id === id ? { ...h, note } : h);
    setHistory(newH);
    localStorage.setItem('smart_calc_history', JSON.stringify(newH));
  };

  const clearHistory = () => {
    if (confirm('Hapus seluruh riwayat struk?')) {
      setHistory([]);
      localStorage.removeItem('smart_calc_history');
      setExpression('');
    }
  };

  const appendToExpression = (val: string) => {
    setExpression(prev => prev + val);
  };

  const copyToNotepad = () => {
    if (history.length === 0) return toast.error('Riwayat kosong');
    let text = "=== STRUK DIGITAL ===\n";
    let grandTotal = 0;
    history.forEach(h => {
      text += `${h.expression} = ${new Intl.NumberFormat('id-ID').format(h.result)} ${h.note ? '('+h.note+')' : ''}\n`;
      grandTotal += h.result; // This assumes we are summing results, but actually the user might just want the list
    });
    text += "=====================\n";
    
    const existing = localStorage.getItem('smart_notepad_draft') || '';
    localStorage.setItem('smart_notepad_draft', existing + '\n' + text);
    
    // Dispatch custom event to tell SmartNotepad to reload from localStorage
    window.dispatchEvent(new Event('storage')); // This is a hacky way if we listen to storage, but better to just use Zustand. Since they are separate components relying on localStorage, a page reload or shared state is better. But for now we just show a toast.
    
    toast.success('Disalin ke Notepad! Pindah ke tampilan Notepad/Split untuk melihatnya.');
    
    // Workaround to refresh notepad:
    const npArea = document.querySelector('textarea[placeholder="Ketik catatan di sini..."]') as HTMLTextAreaElement;
    if (npArea) {
      npArea.value = existing + '\n' + text;
      // Trigger onChange
      const event = new Event('input', { bubbles: true });
      npArea.dispatchEvent(event);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-area');
    if (!printContent) return;
    
    const originalBody = document.body.innerHTML;
    document.body.innerHTML = printContent.innerHTML;
    window.print();
    document.body.innerHTML = originalBody;
    window.location.reload(); // Reload to restore React bindings
  };

  const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID').format(num);

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Header Toolbar */}
      <div className="bg-black/5 dark:bg-white/5 border-b border-border p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-emerald-500" />
          <span className="font-bold text-sm">Mesin Kasir</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyToNotepad} className="p-1.5 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1" title="Copy ke Notepad">
            <Copy size={12} /> <span className="hidden md:inline">Ke Notepad</span>
          </button>
          <button onClick={handlePrint} className="p-1.5 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1" title="Cetak Struk">
            <Printer size={12} /> <span className="hidden md:inline">Cetak</span>
          </button>
          <button onClick={clearHistory} className="p-1.5 text-text-muted hover:text-danger rounded-lg transition-colors" title="Bersihkan">
            <Eraser size={14} />
          </button>
        </div>
      </div>

      {/* Ticker Tape / History (Struk Digital) */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#fdfdfc] dark:bg-[#1e1e1e] font-mono text-sm" ref={scrollRef} id="receipt-area">
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-50">
            <Receipt size={48} className="mb-2" />
            <p className="text-xs">Struk kosong</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-center font-bold border-b border-dashed border-gray-400 pb-2 mb-2">VAULTPRO POS<br/>====================</div>
            {history.map((h, i) => (
              <div key={h.id} className="group relative pr-1">
                <div className="flex justify-between items-end gap-4 text-gray-800 dark:text-gray-300">
                  <span className="text-xs opacity-70 break-all">{h.expression} =</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(h.result)}</span>
                </div>
                <input
                  type="text"
                  value={h.note}
                  onChange={(e) => updateNote(h.id, e.target.value)}
                  placeholder="Ketik nama item/label..."
                  className="w-full bg-transparent border-b border-transparent focus:border-gray-300 text-[10px] italic outline-none mt-1 opacity-50 focus:opacity-100 hover:opacity-100 transition-opacity"
                />
              </div>
            ))}
            <div className="border-t border-dashed border-gray-400 mt-2 pt-2 text-right font-bold text-gray-800 dark:text-gray-200">
              TOTAL: Rp {formatCurrency(history.reduce((acc, h) => acc + h.result, 0))}
            </div>
          </div>
        )}
      </div>

      {/* Calculator Input & Buttons */}
      <div className="bg-black/5 dark:bg-white/5 border-t border-border p-3 shrink-0">
        <form onSubmit={handleCalculate} className="mb-3">
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="Contoh: 10000x10 + 3000x40"
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-mono text-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </form>
        
        <div className="grid grid-cols-4 gap-2">
          {/* Quick Cash Buttons */}
          <button type="button" onClick={() => appendToExpression('+50000')} className="col-span-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold py-2 rounded-lg text-xs hover:bg-emerald-500/20 active:scale-95 transition-all">+50rb</button>
          <button type="button" onClick={() => appendToExpression('+100000')} className="col-span-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold py-2 rounded-lg text-xs hover:bg-emerald-500/20 active:scale-95 transition-all">+100rb</button>
          <button type="button" onClick={() => appendToExpression('*0.9')} className="col-span-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold py-2 rounded-lg text-xs hover:bg-rose-500/20 active:scale-95 transition-all">Diskon 10%</button>
          <button type="button" onClick={() => appendToExpression('*1.11')} className="col-span-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold py-2 rounded-lg text-xs hover:bg-blue-500/20 active:scale-95 transition-all">PPN 11%</button>

          {/* NumPad Basic (Opsional jika ingin dipakai pakai mouse/touch) */}
          <button type="button" onClick={() => appendToExpression('7')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold">7</button>
          <button type="button" onClick={() => appendToExpression('8')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold">8</button>
          <button type="button" onClick={() => appendToExpression('9')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold">9</button>
          <button type="button" onClick={() => appendToExpression('/')} className="bg-black/10 dark:bg-white/10 text-primary font-bold py-2 rounded-lg">/</button>

          <button type="button" onClick={() => appendToExpression('4')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold">4</button>
          <button type="button" onClick={() => appendToExpression('5')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold">5</button>
          <button type="button" onClick={() => appendToExpression('6')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold">6</button>
          <button type="button" onClick={() => appendToExpression('*')} className="bg-black/10 dark:bg-white/10 text-primary font-bold py-2 rounded-lg">X</button>

          <button type="button" onClick={() => appendToExpression('1')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold">1</button>
          <button type="button" onClick={() => appendToExpression('2')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold">2</button>
          <button type="button" onClick={() => appendToExpression('3')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold">3</button>
          <button type="button" onClick={() => appendToExpression('-')} className="bg-black/10 dark:bg-white/10 text-primary font-bold py-2 rounded-lg">-</button>

          <button type="button" onClick={() => appendToExpression('0')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold">0</button>
          <button type="button" onClick={() => appendToExpression('000')} className="bg-surface hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg font-bold text-xs">000</button>
          <button type="button" onClick={() => appendToExpression('+')} className="bg-black/10 dark:bg-white/10 text-primary font-bold py-2 rounded-lg">+</button>
          <button type="button" onClick={handleCalculate} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg shadow-md active:scale-95 transition-all">=</button>
        </div>
      </div>
    </div>
  );
};
