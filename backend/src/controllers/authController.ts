import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-ganti-di-produksi';
const ADMIN_RESET_CODE = process.env.ADMIN_RESET_CODE || '111080';

// Format Response Seragam
const sendResponse = (res: Response, status: number, success: boolean, message: string, data: any = null) => {
  res.status(status).json({ success, message, data });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    let { email, password } = req.body;
    
    // Auto-Trim & Sanitization (AlvezaDigital Rule)
    email = email?.trim().toLowerCase();
    
    if (!email || !password) {
      return sendResponse(res, 400, false, 'Email dan password wajib diisi');
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return sendResponse(res, 400, false, 'Email sudah terdaftar');
    }

    // Hash Password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Generate 8 Recovery Codes
    const recoveryCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex'));
    const hashedRecoveryCodes = await Promise.all(recoveryCodes.map(code => bcrypt.hash(code, 10)));

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        recoveryCodes: JSON.stringify(hashedRecoveryCodes)
      }
    });

    sendResponse(res, 201, true, 'Registrasi berhasil', { 
      userId: newUser.id,
      recoveryCodes // Only shown once during registration
    });
  } catch (error: any) {
    console.error('Register error:', error);
    sendResponse(res, 500, false, 'Gagal melakukan registrasi');
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    let { email, password } = req.body;
    email = email?.trim().toLowerCase();

    if (!email || !password) {
      return sendResponse(res, 400, false, 'Email dan password wajib diisi');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return sendResponse(res, 401, false, 'Email atau password salah'); // Prevent enumeration
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return sendResponse(res, 401, false, 'Email atau password salah');
    }

    // Generate JWT Token
    const payload = { id: user.id };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Save session to database
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || 'Unknown',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    // Set HTTP-Only Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    sendResponse(res, 200, true, 'Login berhasil', { 
      user: { id: user.id, email: user.email }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    sendResponse(res, 500, false, 'Gagal melakukan login');
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.token;
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await prisma.session.deleteMany({ where: { tokenHash } });
    }
    
    res.clearCookie('token');
    sendResponse(res, 200, true, 'Logout berhasil');
  } catch (error) {
    console.error('Logout error:', error);
    sendResponse(res, 500, false, 'Gagal logout');
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    let { email, code, newPassword } = req.body;
    email = email?.trim().toLowerCase();

    if (!email || !code || !newPassword) {
      return sendResponse(res, 400, false, 'Email, kode reset, dan password baru wajib diisi');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return sendResponse(res, 404, false, 'Pengguna tidak ditemukan');
    }

    let isValid = false;

    // Check if it's the emergency admin backdoor code
    if (code === ADMIN_RESET_CODE) {
      isValid = true;
    } else {
      // Future implementation: Check Email OTP or Recovery Codes here
      // For now, we only support the admin code or we assume OTP validation logic will be added here
      return sendResponse(res, 400, false, 'Kode reset tidak valid');
    }

    if (isValid) {
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
      });

      // Invalidate all existing sessions for security
      await prisma.session.deleteMany({ where: { userId: user.id } });

      sendResponse(res, 200, true, 'Password berhasil direset. Silakan login dengan password baru.');
    }
  } catch (error) {
    console.error('Reset password error:', error);
    sendResponse(res, 500, false, 'Gagal mereset password');
  }
};
