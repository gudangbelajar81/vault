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
              // Trigger Alaram
              triggerAlarm(item.name, diffDays);
              localStorage.setItem(lastAlarmKey, Date.now().toString());
            }
          }
        });
      } catch (err) {
        console.error('Gagal mengecek subscription untuk alarm', err);
      }
    };

    const triggerAlarm = (name: string, days: number) => {
      const title = `🚨 Tagihan Jatuh Tempo!`;
      const body = `Langganan ${name} jatuh tempo dalam ${days === 0 ? 'HARI INI' : days + ' hari'}.`;
      
      // Toast notifikasi dalam app
      toast.error(body, {
        duration: 10000,
        icon: '🚨',
        style: { border: '2px solid red' }
      });

      // Browser Notification (jika diluar app/background)
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/vite.svg' });
      }

      // Bunyikan suara
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log('Audio autoplay blocked', e));
      }
    };

    // Cek saat pertama kali komponen dimuat
    checkSubscriptions();

    // Cek setiap 1 menit (siapa tau pergantian hari atau sudah lewat 6 jam saat app sedang terbuka)
    const interval = setInterval(checkSubscriptions, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null; // Komponen berjalan di background, tidak render UI
};
