import React, { useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

const ALARM_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 jam
const ALARM_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export const SubscriptionAlarm = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Inisialisasi audio
    audioRef.current = new Audio(ALARM_SOUND);
    audioRef.current.loop = true; // Loop sampai ditutup atau dibayar
    
    // Minta izin notifikasi browser jika belum
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkSubscriptions = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/subscriptions`, { withCredentials: true });
        const items = res.data.data || [];
        
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        items.forEach((item: any) => {
          if (item.status !== 'active') return;

          const target = new Date(item.nextBillingDate);
          target.setHours(0, 0, 0, 0);
          
          const diffTime = target.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Jika jatuh tempo <= 2 hari dan belum lewat
          if (diffDays >= 0 && diffDays <= 2) {
            const lastAlarmKey = `last_alarm_sub_${item.id}`;
            const lastAlarmStr = localStorage.getItem(lastAlarmKey);
            const lastAlarmTime = lastAlarmStr ? parseInt(lastAlarmStr, 10) : 0;
            
            const timeSinceLastAlarm = Date.now() - lastAlarmTime;

            if (timeSinceLastAlarm >= ALARM_INTERVAL_MS) {
              triggerAlarm(item, diffDays);
              localStorage.setItem(lastAlarmKey, Date.now().toString());
            }
          }
        });
      } catch (err) {
        console.error('Gagal mengecek subscription untuk alarm', err);
      }
    };

    const handlePay = async (item: any, toastId: string) => {
      try {
        const nextDate = new Date(item.nextBillingDate);
        if (item.billingCycle === 'yearly') {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        
        await axios.put(`${API_URL}/api/subscriptions/${item.id}`, {
          ...item,
          nextBillingDate: nextDate.toISOString().split('T')[0]
        }, { withCredentials: true });
        
        toast.success(`Langganan ${item.name} berhasil diperpanjang ke siklus berikutnya!`);
        toast.dismiss(toastId);
        
        if(audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
      } catch (error) {
        toast.error('Gagal memperbarui tagihan');
      }
    };

    const triggerAlarm = (item: any, days: number) => {
      const title = `🚨 Tagihan Jatuh Tempo!`;
      const body = `Langganan ${item.name} jatuh tempo dalam ${days === 0 ? 'HARI INI' : days + ' hari'}.`;
      
      // Bunyikan suara
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log('Audio autoplay blocked', e));
      }

      // Toast notifikasi interaktif dalam app
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-sm w-full bg-surface border-2 border-danger shadow-[0_0_20px_rgba(239,68,68,0.3)] rounded-xl pointer-events-auto flex flex-col p-4`}
        >
          <div className="flex items-start">
            <div className="flex-1">
              <p className="text-sm font-bold text-danger animate-pulse">🚨 Tagihan Mendesak!</p>
              <p className="mt-1 text-xs text-text-primary">
                Langganan <span className="font-bold">{item.name}</span> jatuh tempo {days === 0 ? 'HARI INI' : `dalam ${days} hari`}.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                if (audioRef.current) {
                   audioRef.current.pause();
                   audioRef.current.currentTime = 0;
                }
              }}
              className="flex-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-primary px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border border-border"
            >
              Ingatkan Nanti
            </button>
            <button
              onClick={() => handlePay(item, t.id)}
              className="flex-1 bg-danger hover:bg-danger/90 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors shadow-lg shadow-danger/20"
            >
              Tandai Dibayar
            </button>
          </div>
        </div>
      ), { duration: 60000, id: `alarm_${item.id}` }); // Tampil 1 menit

      // Browser Notification (jika diluar app/background)
      if (Notification.permission === 'granted') {
        const notif = new Notification(title, { body, icon: '/vite.svg' });
        notif.onclick = () => {
          window.focus();
        };
      }
    };

    // Cek saat pertama kali komponen dimuat
    checkSubscriptions();

    // Cek setiap 1 menit
    const interval = setInterval(checkSubscriptions, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
};
