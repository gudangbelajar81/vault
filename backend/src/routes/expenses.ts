import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// BILL PROFILES (Tagihan Tersimpan: PLN, Internet, BPJS, dll)
// ==========================================

// GET /api/expenses/bill-profiles -> daftar profil tagihan tersimpan
router.get('/bill-profiles', authenticate, async (req: any, res) => {
  try {
    const profiles = await prisma.billProfile.findMany({
      where: { userId: req.user.id },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: profiles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal mengambil profil tagihan' });
  }
});

// POST /api/expenses/bill-profiles -> simpan profil tagihan baru
router.post('/bill-profiles', authenticate, async (req: any, res) => {
  try {
    const { name, category, accountNumber, provider, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama tagihan wajib diisi' });
    }
    if (!accountNumber || !accountNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Nomor akun / ID pelanggan wajib diisi' });
    }

    const profile = await prisma.billProfile.create({
      data: {
        userId: req.user.id,
        name: name.trim(),
        category: category || 'Tagihan Bulanan',
        accountNumber: accountNumber.trim(),
        provider: provider?.trim() || null,
        notes: notes?.trim() || null,
      },
    });
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan profil tagihan' });
  }
});

// PUT /api/expenses/bill-profiles/:id -> update profil tagihan
router.put('/bill-profiles/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, category, accountNumber, provider, notes } = req.body;

    const existing = await prisma.billProfile.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Profil tagihan tidak ditemukan' });
    }

    const updated = await prisma.billProfile.update({
      where: { id },
      data: {
        name: name?.trim() ?? existing.name,
        category: category ?? existing.category,
        accountNumber: accountNumber?.trim() ?? existing.accountNumber,
        provider: provider !== undefined ? provider?.trim() : existing.provider,
        notes: notes !== undefined ? notes?.trim() : existing.notes,
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal mengupdate profil tagihan' });
  }
});

// DELETE /api/expenses/bill-profiles/:id -> hapus profil tagihan
router.delete('/bill-profiles/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.billProfile.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Profil tagihan tidak ditemukan' });
    }

    await prisma.billProfile.delete({ where: { id } });
    res.json({ success: true, message: 'Profil tagihan berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal menghapus profil tagihan' });
  }
});

// ==========================================
// EXPENSES (Pengeluaran)
// ==========================================

// Get all expenses for current user
router.get('/', authenticate, async (req: any, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, data: expenses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data pengeluaran' });
  }
});

// Add new expense
router.post('/', authenticate, async (req: any, res) => {
  try {
    const { title, amount, currency, category, date, accountNumber, notes, saveAsProfile, profileName } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Judul pengeluaran wajib diisi' });
    }

    const expense = await prisma.expense.create({
      data: {
        userId: req.user.id,
        title: title.trim(),
        amount: parseFloat(amount) || 0,
        currency: currency || 'IDR',
        category: category || 'Lain-lain',
        date: date ? new Date(date) : new Date(),
        accountNumber: accountNumber?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    // Jika user mencentang "Simpan sebagai profil tagihan untuk bulan depan"
    if (saveAsProfile && accountNumber && accountNumber.trim()) {
      try {
        await prisma.billProfile.create({
          data: {
            userId: req.user.id,
            name: (profileName || title).trim(),
            category: category || 'Tagihan Bulanan',
            accountNumber: accountNumber.trim(),
            provider: null,
            notes: notes?.trim() || null,
          },
        });
      } catch (profErr) {
        console.error('Error auto-saving bill profile:', profErr);
      }
    }

    res.json({ success: true, data: expense });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal menambah pengeluaran' });
  }
});

// Update expense
router.put('/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { title, amount, currency, category, date, accountNumber, notes } = req.body;

    const existing = await prisma.expense.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pengeluaran tidak ditemukan' });
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        title: title?.trim() ?? existing.title,
        amount: amount !== undefined ? (parseFloat(amount) || 0) : existing.amount,
        currency: currency || existing.currency,
        category: category ?? existing.category,
        date: date ? new Date(date) : existing.date,
        accountNumber: accountNumber !== undefined ? (accountNumber?.trim() || null) : existing.accountNumber,
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
      },
    });
    res.json({ success: true, data: expense });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal mengupdate pengeluaran' });
  }
});

// Delete expense
router.delete('/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.expense.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pengeluaran tidak ditemukan' });
    }

    await prisma.expense.delete({ where: { id } });
    res.json({ success: true, message: 'Pengeluaran berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal menghapus pengeluaran' });
  }
});

export default router;
