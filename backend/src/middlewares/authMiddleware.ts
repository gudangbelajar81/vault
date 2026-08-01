import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-ganti-di-produksi';

export interface AuthRequest extends Request {
  user?: { id: string };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.token;
    
    if (!token) {
      res.status(401).json({ success: false, message: 'Tidak ada akses (Token hilang)' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    req.user = { id: decoded.id };
    
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Sesi tidak valid atau kedaluwarsa' });
  }
};
