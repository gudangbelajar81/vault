import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useVaultStore } from '../store/vaultStore';
import { decryptData, encryptData } from '../utils/crypto';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

export const ShareReceiver = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { masterPassword } = useVaultStore();
  const [status, setStatus] = useState('Menerima Link...');

  useEffect(() => {
    processSharedLink();
  }, []);

  const processSharedLink = async () => {
    const title = searchParams.get('title') || '';
    const text = searchParams.get('text') || '';
    const url = searchParams.get('url') || '';
    
    const actualUrl = url || text.match(/https?:\/\/[^\s]+/)?.[0] || '';
    const fallbackTitle = actualUrl ? new URL(actualUrl).hostname : (title || 'Shared Content');
    
    if (!actualUrl && !text) {
      toast.error('Tidak ada link atau teks yang dibagikan');
      navigate('/vault');
      return;
    }

    try {
      setStatus('Menganalisa dengan AI (Groq)...');
      
      const vaultRes = await axios.get(`${API_URL}/api/vault`, { withCredentials: true });
      let groqKey = '';
      
      if (vaultRes.data.success && masterPassword) {
        for (const item of vaultRes.data.data) {
          if (item.type === 'api' && (item.title === 'Groq API Key (Omni Router)' || item.title.toLowerCase().includes('groq'))) {
            try {
              const dec = JSON.parse(await decryptData(item.encryptedData, masterPassword));
              groqKey = dec.key || dec.password || dec.extra || '';
              if (groqKey) break;
            } catch (e) {}
          }
        }
      }

      let category = 'Uncategorized';
      let summary = text || title || 'No description';

      if (groqKey) {
        const prompt = `Analisa link/teks berikut yang dibagikan dari sosmed:
URL: ${actualUrl}
Teks: ${text}
Judul: ${title}

Tugas kamu adalah mengelompokkan kiriman ini ke dalam salah satu kategori berikut: 
Iklan/Penawaran, AI/Prompt, Bisnis/Keuangan, Edukasi/Tutorial, Berita, Hiburan, atau Lainnya.
Berikan output HANYA dengan format pasti di bawah ini tanpa basa-basi:
KATEGORI: [Nama Kategori]
RINGKASAN: [1 kalimat singkat tentang isi atau tujuan konten ini]`;

        try {
          const groqRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama3-8b-8192',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1
          }, {
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            }
          });

          const aiText = groqRes.data.choices[0].message.content;
          const catMatch = aiText.match(/KATEGORI:\s*(.*)/i);
          const sumMatch = aiText.match(/RINGKASAN:\s*(.*)/i);
          if (catMatch) category = catMatch[1].trim();
          if (sumMatch) summary = sumMatch[1].trim();
        } catch (groqErr) {
          console.error("Groq AI Error:", groqErr);
          toast.error('Gagal menghubungi Groq AI. Menggunakan default.');
        }
      } else {
        toast.error('Kunci API Groq tidak ditemukan di Vault! Mode manual aktif.');
      }

      setStatus('Menyimpan ke Pustaka...');
      
      const dataToEncrypt = JSON.stringify({
        url: actualUrl,
        category: category,
        description: summary,
        rawText: text,
        rawTitle: title,
        notes: `AI Summary:\n${summary}`
      });

      const encryptedData = await encryptData(dataToEncrypt, masterPassword!);

      await axios.post(`${API_URL}/api/vault`, {
        type: 'knowledge',
        title: title || fallbackTitle,
        encryptedData,
        favorite: false
      }, { withCredentials: true });

      toast.success('Disimpan & Dikategorikan oleh AI!');
      navigate('/knowledge');

    } catch (error) {
      console.error(error);
      toast.error('Gagal memproses kiriman');
      navigate('/vault');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full p-4 mt-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-6 shadow-[0_0_15px_rgba(var(--color-primary),0.5)]"></div>
      <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary uppercase tracking-wider">{status}</h2>
      <p className="text-text-muted text-sm mt-3 text-center max-w-sm">
        Mohon tunggu sebentar, AI sedang membaca dan mengelompokkan kiriman dari Sosmed Bro...
      </p>
    </div>
  );
};


