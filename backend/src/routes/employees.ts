import express from 'express';
import prisma from '../utils/prisma';
import { authenticate, AuthRequest } from '../middlewares/authMiddleware';

const router = express.Router();

// ============ HELPERS ============
function toNumber(val: any, def = 0): number {
  const n = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]/g, '')) : Number(val);
  return isNaN(n) ? def : n;
}

// ============ EMPLOYEES (Karyawan) ============

// GET /api/employees -> daftar karyawan + ringkasan total kasbon aktif
router.get('/', authenticate, async (req: any, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { userId: req.user!.id },
      orderBy: { name: 'asc' },
      include: {
        cashAdvances: { where: { status: 'Belum Lunas' } },
      },
    });

    const data = employees.map((e) => {
      const totalBon = e.cashAdvances.reduce((sum, c) => sum + c.amount, 0);
      const { cashAdvances, ...rest } = e;
      return { ...rest, totalBonAktif: totalBon };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data karyawan' });
  }
});

// GET /api/employees/:id -> detail 1 karyawan + kasbon + riwayat payroll
router.get('/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const employee = await prisma.employee.findFirst({
      where: { id, userId: req.user!.id },
      include: {
        cashAdvances: { orderBy: { date: 'desc' } },
        payrolls: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal mengambil detail karyawan' });
  }
});

// POST /api/employees -> tambah karyawan baru
router.post('/', authenticate, async (req: any, res) => {
  try {
    const { name, phone, joinDate, salaryType, baseSalary, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi' });
    }
    const employee = await prisma.employee.create({
      data: {
        userId: req.user!.id,
        name: name.trim(),
        phone: phone || null,
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        salaryType: salaryType === 'Harian' ? 'Harian' : 'Bulanan',
        baseSalary: toNumber(baseSalary, 0),
        status: status || 'Aktif',
      },
    });
    res.json({ success: true, data: employee });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal menambah karyawan' });
  }
});

// PUT /api/employees/:id -> update profil karyawan
router.put('/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.employee.findFirst({ where: { id, userId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });
    }
    const { name, phone, joinDate, salaryType, baseSalary, status } = req.body;
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        name: name?.trim() ?? existing.name,
        phone: phone ?? existing.phone,
        joinDate: joinDate ? new Date(joinDate) : existing.joinDate,
        salaryType: salaryType === 'Harian' ? 'Harian' : (salaryType === 'Bulanan' ? 'Bulanan' : existing.salaryType),
        baseSalary: baseSalary !== undefined ? toNumber(baseSalary, existing.baseSalary) : existing.baseSalary,
        status: status ?? existing.status,
      },
    });
    res.json({ success: true, data: employee });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal mengupdate karyawan' });
  }
});

// DELETE /api/employees/:id -> hapus karyawan (ikut hapus kasbon & riwayat gaji via cascade)
router.delete('/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.employee.findFirst({ where: { id, userId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });
    }
    await prisma.employee.delete({ where: { id } });
    res.json({ success: true, message: 'Karyawan berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal menghapus karyawan' });
  }
});

// ============ CASH ADVANCES (Kasbon / Bon) ============

// POST /api/employees/:id/cash-advances -> tambah kasbon baru
router.post('/:id/cash-advances', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params; // employeeId
    const owner = await prisma.employee.findFirst({ where: { id, userId: req.user!.id } });
    if (!owner) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });

    const { date, amount, notes } = req.body;
    const bon = await prisma.cashAdvance.create({
      data: {
        employeeId: id,
        date: date ? new Date(date) : new Date(),
        amount: toNumber(amount, 0),
        notes: notes || null,
        status: 'Belum Lunas',
      },
    });
    res.json({ success: true, data: bon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal menambah kasbon' });
  }
});

// PUT /api/cash-advances/:bonId -> edit kasbon
router.put('/cash-advances/:bonId', authenticate, async (req: any, res) => {
  try {
    const { bonId } = req.params;
    const existing = await prisma.cashAdvance.findFirst({
      where: { id: bonId, employee: { userId: req.user!.id } },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Kasbon tidak ditemukan' });

    const { date, amount, notes, status } = req.body;
    const bon = await prisma.cashAdvance.update({
      where: { id: bonId },
      data: {
        date: date ? new Date(date) : existing.date,
        amount: amount !== undefined ? toNumber(amount, existing.amount) : existing.amount,
        notes: notes ?? existing.notes,
        status: status ?? existing.status,
      },
    });
    res.json({ success: true, data: bon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal mengupdate kasbon' });
  }
});

// DELETE /api/cash-advances/:bonId -> hapus kasbon
router.delete('/cash-advances/:bonId', authenticate, async (req: any, res) => {
  try {
    const { bonId } = req.params;
    const existing = await prisma.cashAdvance.findFirst({
      where: { id: bonId, employee: { userId: req.user!.id } },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Kasbon tidak ditemukan' });

    await prisma.cashAdvance.delete({ where: { id: bonId } });
    res.json({ success: true, message: 'Kasbon berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal menghapus kasbon' });
  }
});

// ============ PAYROLLS (Riwayat Gaji / Cairkan Gaji) ============

// POST /api/employees/:id/payrolls -> proses & simpan penggajian
// Potong kasbon aktif sejumlah `cicilKasbon`, sisanya dirollover jadi kasbon baru.
router.post('/:id/payrolls', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params; // employeeId
    const employee = await prisma.employee.findFirst({
      where: { id, userId: req.user!.id },
      include: { cashAdvances: { where: { status: 'Belum Lunas' } } },
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });

    const {
      periodStart, periodEnd, attendanceDays, basicSalaryCalculated,
      cicilKasbon, notes, resetJoinDate,
    } = req.body;

    const totalBon = employee.cashAdvances.reduce((sum, c) => sum + c.amount, 0);
    const cicil = Math.min(toNumber(cicilKasbon, 0), totalBon);
    const basicCalc = toNumber(basicSalaryCalculated, employee.baseSalary);
    const net = basicCalc - cicil;
    const sisaBon = Math.max(0, totalBon - cicil);

    const result = await prisma.$transaction(async (tx) => {
      // Tandai semua kasbon aktif sebagai Lunas (sudah diproses di periode ini)
      if (employee.cashAdvances.length > 0) {
        await tx.cashAdvance.updateMany({
          where: { id: { in: employee.cashAdvances.map((c) => c.id) } },
          data: { status: 'Lunas' },
        });
      }

      // Jika ada sisa bon (dicicil sebagian), buat entri kasbon baru untuk sisa
      if (sisaBon > 0) {
        await tx.cashAdvance.create({
          data: {
            employeeId: id,
            date: new Date(),
            amount: sisaBon,
            notes: 'Rollover sisa kasbon dari penggajian sebelumnya',
            status: 'Belum Lunas',
          },
        });
      }

      const payroll = await tx.payroll.create({
        data: {
          employeeId: id,
          periodStart: periodStart ? new Date(periodStart) : null,
          periodEnd: periodEnd ? new Date(periodEnd) : null,
          attendanceDays: toNumber(attendanceDays, 0),
          basicSalaryCalculated: basicCalc,
          totalDeductionBon: cicil,
          netSalary: net,
          sisaBon,
          notes: notes || null,
        },
      });

      // Opsional: majukan tanggal masuk (untuk hitung periode harian berikutnya)
      if (resetJoinDate) {
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        await tx.employee.update({ where: { id }, data: { joinDate: nextDay } });
      }

      return payroll;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal memproses penggajian' });
  }
});

// DELETE /api/payrolls/:payrollId -> hapus riwayat gaji
router.delete('/payrolls/:payrollId', authenticate, async (req: any, res) => {
  try {
    const { payrollId } = req.params;
    const existing = await prisma.payroll.findFirst({
      where: { id: payrollId, employee: { userId: req.user!.id } },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Riwayat gaji tidak ditemukan' });

    await prisma.payroll.delete({ where: { id: payrollId } });
    res.json({ success: true, message: 'Riwayat gaji berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal menghapus riwayat gaji' });
  }
});

export default router;
