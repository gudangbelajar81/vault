import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, Pause, RotateCcw, Settings2, Coffee, Brain } from 'lucide-react';
import toast from 'react-hot-toast';

type Mode = 'work' | 'break';

const SETTINGS_KEY = 'vaultpro_pomodoro_settings';

interface PomodoroSettings {
  workMin: number;
  breakMin: number;
  longBreakMin: number;
  cyclesBeforeLongBreak: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  workMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  cyclesBeforeLongBreak: 4,
};

const loadSettings = (): PomodoroSettings => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
};

const saveSettings = (s: PomodoroSettings) => {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
};

/** Beep notifikasi sederhana via Web Audio API (tanpa file audio eksternal). */
const playBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };
    playTone(880, 0, 0.18);
    playTone(1040, 0.22, 0.22);
  } catch {
    // ignore (autoplay restrictions, dll)
  }
};

const fmt = (sec: number) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const PomodoroPanel: React.FC = () => {
  const [settings, setSettings] = useState<PomodoroSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<Mode>('work');
  const [secondsLeft, setSecondsLeft] = useState(settings.workMin * 60);
  const [running, setRunning] = useState(false);
  const [cyclesDone, setCyclesDone] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalForMode = useCallback((m: Mode, cycles: number) => {
    if (m === 'work') return settings.workMin * 60;
    const isLong = (cycles + 1) % settings.cyclesBeforeLongBreak === 0;
    return (isLong ? settings.longBreakMin : settings.breakMin) * 60;
  }, [settings]);

  // Reset timer tampilan kalau settings berubah & timer tidak jalan
  useEffect(() => {
    if (!running) setSecondsLeft(totalForMode(mode, cyclesDone));
  }, [settings, mode, cyclesDone, running, totalForMode]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          playBeep();
          if (mode === 'work') {
            const nextCycles = cyclesDone + 1;
            setCyclesDone(nextCycles);
            setMode('break');
            toast.success('Waktunya istirahat sejenak! ☕');
            return totalForMode('break', nextCycles);
          } else {
            setMode('work');
            toast.success('Istirahat selesai, saatnya fokus lagi! 🧠');
            return totalForMode('work', cyclesDone);
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  const toggleRunning = () => setRunning(r => !r);

  const resetTimer = () => {
    setRunning(false);
    setSecondsLeft(totalForMode(mode, cyclesDone));
  };

  const switchMode = (m: Mode) => {
    setRunning(false);
    setMode(m);
    setSecondsLeft(totalForMode(m, cyclesDone));
  };

  const updateSetting = (key: keyof PomodoroSettings, val: number) => {
    const ns = { ...settings, [key]: Math.max(1, val) };
    setSettings(ns);
    saveSettings(ns);
  };

  const total = totalForMode(mode, cyclesDone);
  const progress = total > 0 ? ((total - secondsLeft) / total) * 100 : 0;
  const isWork = mode === 'work';

  return (
    <div className="flex flex-col items-center gap-6 max-w-xl mx-auto py-6">
      <div className="flex items-center justify-between w-full">
        <div>
          <h3 className="font-bold text-base text-text-primary flex items-center gap-2">
            <Timer size={18} className="text-rose-400" /> Fokus Pomodoro
          </h3>
          <p className="text-xs text-text-muted">Teknik manajemen waktu untuk fokus kerja tanpa burnout.</p>
        </div>
        <button
          onClick={() => setShowSettings(s => !s)}
          className="p-2 rounded-xl border border-border text-text-muted hover:text-text-primary hover:bg-white/5"
          title="Atur durasi"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {showSettings && (
        <div className="w-full bg-surface border border-border rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-text-muted">
            Fokus (menit)
            <input
              type="number"
              min={1}
              value={settings.workMin}
              onChange={e => updateSetting('workMin', parseInt(e.target.value) || 1)}
              className="bg-white/5 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-text-muted">
            Istirahat (menit)
            <input
              type="number"
              min={1}
              value={settings.breakMin}
              onChange={e => updateSetting('breakMin', parseInt(e.target.value) || 1)}
              className="bg-white/5 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-text-muted">
            Istirahat Panjang
            <input
              type="number"
              min={1}
              value={settings.longBreakMin}
              onChange={e => updateSetting('longBreakMin', parseInt(e.target.value) || 1)}
              className="bg-white/5 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-text-muted">
            Siklus/Istirahat Panjang
            <input
              type="number"
              min={1}
              value={settings.cyclesBeforeLongBreak}
              onChange={e => updateSetting('cyclesBeforeLongBreak', parseInt(e.target.value) || 1)}
              className="bg-white/5 border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none"
            />
          </label>
        </div>
      )}

      {/* Mode Switch */}
      <div className="flex items-center gap-2 p-1 bg-surface border border-border rounded-2xl">
        <button
          onClick={() => switchMode('work')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            isWork ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Brain size={14} /> Fokus
        </button>
        <button
          onClick={() => switchMode('break')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            !isWork ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Coffee size={14} /> Istirahat
        </button>
      </div>

      {/* Circular Timer */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
          <circle
            cx="50" cy="50" r="44" fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
            className={isWork ? 'text-rose-400' : 'text-emerald-400'}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="flex flex-col items-center">
          <span className="text-5xl font-black text-text-primary tabular-nums">{fmt(secondsLeft)}</span>
          <span className="text-xs font-semibold text-text-muted mt-1">
            {isWork ? 'Waktunya Fokus' : 'Waktunya Istirahat'} · Siklus ke-{cyclesDone + 1}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleRunning}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm shadow-lg transition-all ${
            running
              ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20'
              : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:brightness-110 shadow-rose-500/20'
          }`}
        >
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? 'Pause' : 'Mulai'}
        </button>
        <button
          onClick={resetTimer}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-xs border border-border text-text-muted hover:text-text-primary hover:bg-white/5"
        >
          <RotateCcw size={15} /> Ulang
        </button>
      </div>

      <p className="text-[11px] text-text-muted text-center max-w-xs">
        Total siklus fokus selesai hari ini: <span className="text-text-primary font-bold">{cyclesDone}</span>
      </p>
    </div>
  );
};
