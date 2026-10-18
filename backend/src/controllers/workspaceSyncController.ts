import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/authMiddleware';

const prisma = new PrismaClient();

// Pull: ambil snapshot terbaru dari cloud buat user ini
export const pullWorkspace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const sync = await prisma.workspaceSync.findUnique({ where: { userId } });

    if (!sync) {
      res.json({ success: true, message: 'Belum ada data sinkronisasi di cloud', data: null });
      return;
    }

    res.json({
      success: true,
      message: 'Berhasil mengambil data Ruang Kerja dari cloud',
      data: {
        dataJson: sync.dataJson,
        syncedAt: sync.syncedAt,
        deviceInfo: sync.deviceInfo,
      },
    });
  } catch (error: any) {
    console.error('pullWorkspace error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data sinkronisasi' });
  }
};

// Push: upload snapshot terbaru (upsert, last-write-wins)
export const pushWorkspace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { dataJson, deviceInfo } = req.body as { dataJson?: string; deviceInfo?: string };

    if (!dataJson || typeof dataJson !== 'string') {
      res.status(400).json({ success: false, message: 'dataJson harus diisi (JSON string)' });
      return;
    }

    // Validasi ringan: pastikan ini JSON valid sebelum disimpan
    try {
      JSON.parse(dataJson);
    } catch {
      res.status(400).json({ success: false, message: 'dataJson bukan JSON yang valid' });
      return;
    }

    const sync = await prisma.workspaceSync.upsert({
      where: { userId },
      create: { userId, dataJson, deviceInfo: deviceInfo || null },
      update: { dataJson, deviceInfo: deviceInfo || null },
    });

    res.json({
      success: true,
      message: 'Ruang Kerja berhasil disinkronkan ke cloud',
      data: { syncedAt: sync.syncedAt },
    });
  } catch (error: any) {
    console.error('pushWorkspace error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyinkronkan data ke cloud' });
  }
};

// Status: cek timestamp terakhir sync tanpa narik seluruh blob (buat badge UI)
export const getWorkspaceSyncStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const sync = await prisma.workspaceSync.findUnique({
      where: { userId },
      select: { syncedAt: true, deviceInfo: true },
    });

    res.json({
      success: true,
      data: sync ? { syncedAt: sync.syncedAt, deviceInfo: sync.deviceInfo } : null,
    });
  } catch (error: any) {
    console.error('getWorkspaceSyncStatus error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil status sinkronisasi' });
  }
};
