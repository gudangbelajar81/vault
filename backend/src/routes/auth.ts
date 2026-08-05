import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, resetPassword } from '../controllers/authController';

const router = Router();

// Strict Rate Limiting khusus untuk autentikasi (Mencegah Brute Force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  limit: 5, // Maksimal 5x gagal/coba per IP
  message: { error: 'Terlalu banyak percobaan login/register, silakan tunggu 15 menit.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/reset-password', authLimiter, resetPassword);

export default router;
