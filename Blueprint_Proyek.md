# 🏛️ BLUEPRINT PROYEK: VAULTPRO
> **Dokumen Handoff Konteks Lengkap — Standar Senior Architect**  
> *Tanggal Dibuat: 18 Oktober 2026*  
> *Lokasi Proyek:* `F:\BLUEPRINT APLIKASI\vaultpro\`  
> *Gunakan dokumen ini untuk meneruskan sesi chat baru tanpa kehilangan konteks teknis atau riwayat implementasi.*

---

## 1. Identitas & Ringkasan Proyek

- **Nama Proyek:** VaultPro (Personal Encrypted Vault & Digital Command Center)
- **Tujuan Utama:** Brankas digital mandiri dengan zero-knowledge encryption client-side, pengelola lisensi software klien (ALVES Smart Licensing), pengelola API keys, intelijen konten (Apify scraper), pelacak pengeluaran & langganan SaaS, serta Ruang Kerja (Workspace) multi-alat produktivitas harian.
- **Teknologi Stack:**
  - **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Zustand, Lucide React, localforage, react-hot-toast, DOM Range API.
  - **Backend:** Node.js, Express, TypeScript, Prisma ORM, MySQL, Helmet, Cookie-Parser, Express Rate Limit, WebAuthn (@simplewebauthn).
  - **Kriptografi:** Web Crypto API (AES-256-GCM, PBKDF2 100.000 iterasi, SHA-256 password salting, RSA Keypairs untuk license signing).
  - **Environment Ports:** Frontend `http://localhost:5173`, Backend `http://localhost:5001`. Domain Produksi: `https://vault.novuq.com`.

---

## 2. Arsitektur Dual-Storage (PENTING)

VaultPro memisahkan data menjadi **Dua Lapisan Penyimpanan**:

```
┌─────────────────────────────────────────────────────────────────┐
│                           VAULTPRO                              │
├───────────────────────────────┬─────────────────────────────────┤
│    SERVER VAULT (Encrypted)   │  LOCAL RUANG KERJA (Client DB)  │
├───────────────────────────────┼─────────────────────────────────┤
│ • Penyimpanan: MySQL (Prisma) │ • Penyimpanan: IndexedDB        │
│ • Akses: Wajib Login + Master │   (via localforage)             │
│   Password                    │ • Akses: Instan tanpa login     │
│ • Zero-Knowledge AES-256-GCM  │ • Status: Plaintext lokal       │
│ • Konten: Password, API Keys, │   (Rencana Enkripsi di Backlog) │
│   Lisensi, Langganan, Finance │ • Konten: Multi-page Notes,     │
│                               │   Stickies, Whiteboard, Sheets  │
└───────────────────────────────┴─────────────────────────────────┘
```

---

## 3. Struktur Database (Prisma / MySQL)

File Schema: `backend/prisma/schema.prisma`

### Model Utama:
1. **User:** ID (UUID), Email, `passwordHash`, `recoveryCodes` (hashed backup codes), `currentChallenge` (WebAuthn).
2. **Session:** ID, `userId`, `tokenHash` (unique), `deviceInfo`, `ipAddress`, `expiresAt`.
3. **WebAuthnCredential:** FIDO2 Biometric credentials (`credentialId`, `publicKey`, `counter`, `transports`).
4. **VaultItem:** Item brankas (`type`: password/api/course/shortcut, `title`, `encryptedData` AES-256-GCM, `favorite`).
5. **Subscription:** Pelacak langganan SaaS (`name`, `price`, `currency`, `billingCycle`, `nextBillingDate`, `status`, `accountEmail`).
6. **Expense:** Pelacak pengeluaran (`title`, `amount`, `category`, `date`, `notes`).
7. **License:** Lisensi software ALVES (`client_name`, `app_code`, `wa_number`, `machine_id`, `tier`, `license_key`).
8. **Package:** Tier paket lisensi (`tier_code`, `display_name`, `price`, `features`).
9. **Otp:** Aktivasi mesin kasir/desktop via WhatsApp OTP (`otp_code`, `machine_id`, `app_code`, `status`, `expires_at`).

---

## 4. Peta Modul & Navigasi Aplikasi

Struktur Route Frontend (`frontend/src/App.tsx`):

### A. Modul Tertutup (Harus Login & Master Password - `AccessLayout`):
- `/vault`: Brankas password, kartu kredit, identitas terenkripsi.
- `/apps`: App Manager (Peluncur aplikasi web dengan injeksi kredensial).
- `/api-keys`: Multi-provider API Key Manager (OpenAI, Gemini, Apify, Midtrans, Groq, dll).
- `/subscriptions`: Manajemen biaya langganan berulang dengan alarm jatuh tempo.
- `/courses`: Brankas materi e-course dan link video pembelajaran.
- `/expenses`: Catatan kas pengeluaran operasional.
- `/employees`: **Modul Karyawan** — CRUD profil, kasbon/bon, kalkulator gaji (harian/bulanan), potong kasbon otomatis + rollover sisa, riwayat payroll, kirim struk WA.

### B. Modul Terbuka (Bebas Masuk Tanpa Halangan Login):
- `/workspace`: Meja kerja instan.
- `/ruang-kerja`: **Ruang Kerja Terpadu** (Buku Catatan, Tempel/Stickies, Whiteboard Canvas, Tabel Mini-Spreadsheet, Bookmarks, Ekspor/Impor JSON).
- `/knowledge`: Knowledge Base & catatan SOP.
- `/intelligence`: Intelligence Hub (Scraper media sosial TikTok, IG, FB, Maps, YouTube via Apify Key yang diambil otomatis dari Vault).
- `/shortcuts`: Mind Map & Jalan Pintas relasi akun ke layanan.
- `/identity-map`: Pemetaan identitas persona digital.
- `/licenses`: Dashboard pengelola lisensi ALVES (generate key, aktivasi mesin, revokasi).
- `/settings`: Pengaturan tema, master password, backup vault, WebAuthn.

---

## 5. Fitur Terbaru yang Sudah Beres (Update Oktober 2026)

### 1. Fix Sisipkan Link (RichEditor.tsx)
- **Problem Sebelumnya:** Seleksi teks hilang saat klik tombol URL (`document.execCommand` usang & gagal inject tag `<a>`).
- **Solusi:**
  - Menambahkan listener `selectionchange` dan ref `selectedTextRef`.
  - Tombol link memicu `saveSelection()` pada event `onMouseDown` sebelum fokus hilang.
  - Modal prefill teks dari seleksi.
  - Eksekusi menggunakan DOM Native Range API: `Range.deleteContents()` + `Range.insertNode()` dengan atribut `target="_blank"`, `rel="noopener noreferrer"`, dan warna aksen `text-cyan-400 font-semibold underline`.

### 2. Hash Keamanan Page-Lock (NoteEditor.tsx)
- **Problem Sebelumnya:** Password kunci halaman tersimpan plaintext di field `passwordHash`.
- **Solusi:**
  - Ditambahkan kriptografi browser standar SHA-256 + unique 16-byte random salt (`newSalt()`).
  - Format penyimpanan: `salt_hex:hash_hex`.
  - Verifikasi asinkron `crypto.subtle.digest('SHA-256')` dengan fallback kompatibilitas plaintext lama.

### 3. Folder Hierarki Buku Catatan (NotesPanel.tsx)
- **Problem Sebelumnya:** Catatan buku tampil flat grid tanpa pengelompokan folder, meski schema `folder: string | null` sudah ada di `workspaceStorage.ts`.
- **Solusi:**
  - Bar Filter Folder terpasang dengan chip dinamis: `Semua`, `Tanpa Folder`, serta folder-folder kustom dengan penghitung buku aktif.
  - Tombol `Folder Baru` untuk membuat kategori folder instan.
  - Kartu buku menampilkan badge folder (`FolderOpen` icon).
  - Tombol pindah folder (`Folder` icon) di footer kartu buku membuka modal perpindahan buku ke folder baru / folder yang ada / tanpa folder.
  - Fungsi `handleCreate` otomatis mengasosiasikan buku baru ke folder yang sedang aktif.

### 4. Modul Karyawan — Gaji & Bon (Oktober 2026)
- **Prisma schema:** 3 model baru — `Employee`, `CashAdvance`, `Payroll` (relasi ke `User`).
- **Backend route** `backend/src/routes/employees.ts` — CRUD karyawan, CRUD kasbon, proses penggajian dengan potong kasbon otomatis + rollover sisa bon, hapus riwayat gaji. Semua endpoint di bawah `/api/employees`.
- **Frontend page** `frontend/src/pages/Employees.tsx` — List karyawan + dashboard per karyawan (profil, kasbon, kalkulator gaji realtime, riwayat payroll, kirim struk via WA).
- **Navigasi:** Masuk `AccessLayout` (gerbang akses utama, tab "Karyawan" dengan icon `Users`), highlight sidebar/mobile nav saat di halaman `/employees`.
- **Production:** Live di `https://vault.novuq.com` + `https://api-vault.novuq.com/api/employees` (HTTP 200 verified). Coolify auto-deploy dari commit `45f083b` (feat) + `b98e78b` (fix Dockerfile).

### 5. Build Status (Oktober 2026)
- **Build Tool:** `tsc && vite build`
- **Status:** **PASS (Exit Code 0)** — frontend & backend tsc clean, Prisma generate clean.

---

## 6. Backlog Pengembangan & Peningkatan Enterprise (Roadmap)

Jika user ingin upgrade level maksimal, pilih dari daftar ini:

1. **[P0 - Security] Enkripsi IndexedDB Ruang Kerja:**
   - Memasang enkripsi AES-256-GCM pada data `localforage` (catatan, lembar kerja, whiteboard) menggunakan Master Password yang ada di `crypto.ts`.
2. **[P1 - Cloud Sync] Sinkronisasi Ruang Kerja ke Backend Vault:**
   - Fitur tombol *Push to Vault* / *Auto-Sync* agar catatan lokal ter-backup ke database MySQL server.
3. **[P2 - UX Editor] Markdown Toggle & Live Preview:**
   - Switch mode antara Rich Text WYSIWYG dan Markdown editor mentah.
4. **[P3 - Search] Search Term Highlighter:**
   - Highlight warna kuning neon pada kata kunci pencarian global di judul maupun body halaman.
5. **[P4 - AI Copilot] Autocomplete & Summarizer Catatan:**
   - Menghubungkan API Key (Gemini/OpenAI) dari brankas ke Rich Editor untuk fitur "Lanjutkan Tulisan", "Ringkas Catatan", atau "Perbaiki Tata Bahasa".
6. **[P5 - Export Pro] Ekspor Buku ke PDF / DOCX:**
   - Konversi seluruh halaman dalam satu buku catatan menjadi satu bundel dokumen PDF dengan cover warna.

---

## 7. Panduan Menjalankan Proyek (Quick Start)

### Backend:
```powershell
cd "F:\BLUEPRINT APLIKASI\vaultpro\backend"
npm run dev
# Berjalan di port 5001
```

### Frontend:
```powershell
cd "F:\BLUEPRINT APLIKASI\vaultpro\frontend"
npm run dev
# Berjalan di port 5173
```

### Build & Verifikasi:
```powershell
cd "F:\BLUEPRINT APLIKASI\vaultpro\frontend"
npm run build
```

---

## 8. Format Prompt untuk Sesi Chat Baru

Salin teks di bawah ini ke chat baru untuk langsung melanjutkan pekerjaan:

```text
Halo Bro! Kita sedang mengerjakan proyek VaultPro di path F:\BLUEPRINT APLIKASI\vaultpro.
Tolong baca file F:\BLUEPRINT APLIKASI\vaultpro\Blueprint_Proyek.md sebagai konteks utama arsitektur dan riwayat progres terakhir.
Semua fitur catatan (RichEditor link, lock hash SHA-256, folder hierarki buku) sudah selesai dan build pass (exit code 0).
Hari ini kita mau melanjutkan task berikutnya: [SEBUTKAN_TASK_DISINI, contoh: Enkripsi Workspace localforage / Auto-sync Server Vault].
Gas!
```
