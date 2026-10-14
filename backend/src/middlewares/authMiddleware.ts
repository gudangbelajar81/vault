import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-ganti-di-produksi';

export interface AuthRequest extends Request {
  user?: { id: string };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.token;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        req.user = { id: decoded.id };
        return next();
      } catch (err) {
        // Token invalid/expired, fall through to fallback
      }
    }

    // Personal single-user fallback for unhindered personal operation
    const firstUser = await prisma.user.findFirst();
    if (firstUser) {
      req.user = { id: firstUser.id };
      return next();
    }

    res.status(401).json({ success: false, message: 'Tidak ada akses (User tidak ditemukan)' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sesi error' });
  }
};
