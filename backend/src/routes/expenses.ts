import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

// Get all expenses for current user
router.get('/', authenticate, async (req: any, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' }
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
    const { title, amount, currency, category, date, notes } = req.body;
    const expense = await prisma.expense.create({
      data: {
        userId: req.user.id,
        title,
        amount: parseFloat(amount),
        currency: currency || 'IDR',
        category,
        date: new Date(date),
        notes
      }
    });
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
    const { title, amount, currency, category, date, notes } = req.body;

    const existing = await prisma.expense.findFirst({
      where: { id, userId: req.user.id }
    });
    
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pengeluaran tidak ditemukan' });
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        title,
        amount: parseFloat(amount),
        currency: currency || 'IDR',
        category,
        date: new Date(date),
        notes
      }
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
      where: { id, userId: req.user.id }
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
