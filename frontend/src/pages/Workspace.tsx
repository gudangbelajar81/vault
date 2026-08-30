import React, { useState } from 'react';
import { SmartNotepad } from '../components/SmartNotepad';
import { SmartCalculator } from '../components/SmartCalculator';
import { LayoutPanelLeft, Calculator, BookOpen, Minimize2, Maximize2 } from 'lucide-react';

type ViewMode = 'split' | 'notepad' | 'calculator';

export const Workspace: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* Header & View Toggles */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center gap-3">
            <LayoutPanelLeft size={28} className="text-blue-500" />
            Meja Kerja
          </h1>
          <p className="text-sm text-text-muted mt-1">Notepad Pintar & Kalkulator Kasir Terintegrasi AI</p>
        </div>

        <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-border">
          <button
            onClick={() => setViewMode('notepad')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'notepad' ? 'bg-surface shadow-sm text-blue-500' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <BookOpen size={14} /> Notepad
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'split' ? 'bg-surface shadow-sm text-primary' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <LayoutPanelLeft size={14} /> Split
          </button>
          <button
            onClick={() => setViewMode('calculator')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'calculator' ? 'bg-surface shadow-sm text-emerald-500' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Calculator size={14} /> Kalkulator
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 min-h-0 flex flex-col md:flex-row gap-4 transition-all duration-300`}>
        {/* Notepad Pane */}
        <div className={`flex flex-col min-h-0 transition-all duration-300 ${
          viewMode === 'calculator' ? 'hidden' : viewMode === 'split' ? 'md:w-1/2 flex-1' : 'w-full flex-1'
        }`}>
          <SmartNotepad />
        </div>

        {/* Calculator Pane */}
        <div className={`flex flex-col min-h-0 transition-all duration-300 ${
          viewMode === 'notepad' ? 'hidden' : viewMode === 'split' ? 'md:w-1/2 flex-1' : 'w-full flex-1'
        }`}>
          <SmartCalculator />
        </div>
      </div>
    </div>
  );
};
