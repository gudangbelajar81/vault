import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../utils/prisma';

const sendResponse = (res: Response, status: number, success: boolean, message: string, data: any = null) => {
  res.status(status).json({ success, message, data });
};

// GET all subscriptions
export const getSubscriptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendResponse(res, 401, false, 'Unauthorized');

    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      orderBy: { nextBillingDate: 'asc' },
    });

    sendResponse(res, 200, true, 'Berhasil mengambil data langganan', subscriptions);
  } catch (error) {
    console.error('getSubscriptions error:', error);
    sendResponse(res, 500, false, 'Gagal mengambil data langganan');
  }
};

// POST create subscription
export const createSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendResponse(res, 401, false, 'Unauthorized');

    let { name, price, currency, billingCycle, nextBillingDate, status, category, logoUrl, encryptedNotes, accountEmail } = req.body;

    if (!name || !price || !nextBillingDate) {
      return sendResponse(res, 400, false, 'Nama, harga, dan tanggal tagihan wajib diisi');
    }

    const sub = await prisma.subscription.create({
      data: {
        userId,
        name: name.trim(),
        price: parseFloat(price),
        currency: currency || 'IDR',
        billingCycle: billingCycle || 'monthly',
        nextBillingDate: new Date(nextBillingDate),
        status: status || 'active',
        accountEmail: accountEmail || null,
        encryptedNotes: encryptedNotes || null,
      },
    });

    sendResponse(res, 201, true, 'Langganan berhasil ditambahkan', sub);
  } catch (error) {
    console.error('createSubscription error:', error);
    sendResponse(res, 500, false, 'Gagal menambah langganan');
  }
};

// PUT update subscription
export const updateSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return sendResponse(res, 401, false, 'Unauthorized');

    const existing = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!existing) return sendResponse(res, 404, false, 'Langganan tidak ditemukan');

    const { name, price, currency, billingCycle, nextBillingDate, status, accountEmail, encryptedNotes } = req.body;

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(currency && { currency }),
        ...(billingCycle && { billingCycle }),
        ...(nextBillingDate && { nextBillingDate: new Date(nextBillingDate) }),
        ...(status && { status }),
        ...(accountEmail !== undefined && { accountEmail }),
        ...(encryptedNotes !== undefined && { encryptedNotes }),
      },
    });

    sendResponse(res, 200, true, 'Langganan berhasil diperbarui', updated);
  } catch (error) {
    console.error('updateSubscription error:', error);
    sendResponse(res, 500, false, 'Gagal memperbarui langganan');
  }
};

// DELETE subscription
export const deleteSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return sendResponse(res, 401, false, 'Unauthorized');

    const existing = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!existing) return sendResponse(res, 404, false, 'Langganan tidak ditemukan');

    await prisma.subscription.delete({ where: { id } });

    sendResponse(res, 200, true, 'Langganan berhasil dihapus');
  } catch (error) {
    console.error('deleteSubscription error:', error);
    sendResponse(res, 500, false, 'Gagal menghapus langganan');
  }
};
