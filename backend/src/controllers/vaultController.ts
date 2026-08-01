import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/authMiddleware';

const prisma = new PrismaClient();

// Get all vault items for the logged in user
export const getVaultItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const items = await prisma.vaultItem.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      message: 'Berhasil mengambil data vault',
      data: items,
    });
  } catch (error: any) {
    console.error('getVaultItems error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data vault' });
  }
};

// Create a new vault item
export const createVaultItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { type, title, encryptedData, favorite } = req.body;

    if (!type || !title || !encryptedData) {
      res.status(400).json({ success: false, message: 'Type, title, dan encryptedData harus diisi' });
      return;
    }

    const newItem = await prisma.vaultItem.create({
      data: {
        userId,
        type,
        title,
        encryptedData,
        favorite: favorite || false,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Item berhasil ditambahkan',
      data: newItem,
    });
  } catch (error: any) {
    console.error('createVaultItem error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan item' });
  }
};

// Bulk create vault items (for CSV Import)
export const bulkCreateVaultItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Data item tidak valid atau kosong' });
      return;
    }

    const newItems = await prisma.vaultItem.createMany({
      data: items.map((item: any) => ({
        userId,
        type: item.type || 'password',
        title: item.title,
        encryptedData: item.encryptedData,
        favorite: item.favorite || false,
      })),
    });

    res.status(201).json({
      success: true,
      message: `${newItems.count} item berhasil diimpor`,
      count: newItems.count
    });
  } catch (error: any) {
    console.error('bulkCreateVaultItems error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengimpor data massal' });
  }
};

// Bulk update vault items (for Changing Master Password)
export const bulkUpdateVaultItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Data item tidak valid atau kosong' });
      return;
    }

    // Prisma doesn't have bulk update with different data per row, so we use transaction
    const updatePromises = items.map((item: any) => 
      prisma.vaultItem.updateMany({
        where: { id: item.id, userId },
        data: {
          encryptedData: item.encryptedData
        }
      })
    );

    await prisma.$transaction(updatePromises);

    res.json({
      success: true,
      message: `${items.length} item berhasil diperbarui`
    });
  } catch (error: any) {
    console.error('bulkUpdateVaultItems error:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui data massal' });
  }
};

// Update an existing vault item
export const updateVaultItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { type, title, encryptedData, favorite } = req.body;

    // Check if item belongs to user
    const existing = await prisma.vaultItem.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Item tidak ditemukan' });
      return;
    }

    const updatedItem = await prisma.vaultItem.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(title && { title }),
        ...(encryptedData && { encryptedData }),
        ...(favorite !== undefined && { favorite }),
      },
    });

    res.json({
      success: true,
      message: 'Item berhasil diperbarui',
      data: updatedItem,
    });
  } catch (error: any) {
    console.error('updateVaultItem error:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui item' });
  }
};

// Soft delete a vault item
export const deleteVaultItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Check if item belongs to user
    const existing = await prisma.vaultItem.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Item tidak ditemukan' });
      return;
    }

    await prisma.vaultItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    res.json({
      success: true,
      message: 'Item berhasil dihapus',
    });
  } catch (error: any) {
    console.error('deleteVaultItem error:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus item' });
  }
};
