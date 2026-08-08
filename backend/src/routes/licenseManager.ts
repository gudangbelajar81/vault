import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import {
  loginAdmin,
  generateLicense,
  listLicenses,
  deleteLicense,
  getPackages,
  addPackage,
  updatePackage,
  deletePackage,
  getPublicKey,
  verifyLicense,
  requestOtp,
  otpStatus,
  bindOtp
} from '../controllers/licenseManagerController';

const router = Router();

// Rate Limiter untuk Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak percobaan login, coba lagi nanti.' },
  handler: (req: Request, res: Response, next: NextFunction, options: any) => {
    console.error(`[SECURITY ALERT] Upaya brute-force login terdeteksi dari IP: ${req.ip || 'Unknown'}`);
    res.status(options.statusCode).send(options.message);
  }
});

// Middleware: Siluman Authentication (Mendukung Cookie Vault Pro ATAU Bearer Token lama)
const authenticateAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const bearerToken = req.headers.authorization?.split(' ')[1];
  const cookieToken = req.cookies?.token;
  const token = bearerToken || cookieToken;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Tidak ada akses (Token hilang)' });
    return;
  }
  
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-ganti-di-produksi');
    
    // Jika token punya role admin (Legacy), ATAU token punya id (Vault Pro User Session), izinkan masuk.
    if (decoded.role === 'admin' || decoded.id) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Invalid Token' });
  }
};

// ==========================================
// PUBLIC & CLIENT-FACING APIs (TIDAK BOLEH BERUBAH)
// ==========================================
router.get('/public-key', getPublicKey);
router.post('/verify', verifyLicense);
router.post('/otp/request', requestOtp);
router.get('/otp/status', otpStatus);

// ==========================================
// ADMIN AUTHENTICATION (LEGACY)
// ==========================================
router.post('/login', loginLimiter, loginAdmin);

// ==========================================
// SECURE ADMIN APIs
// ==========================================
router.post('/generate', authenticateAdmin, generateLicense);
router.get('/licenses', authenticateAdmin, listLicenses);
router.delete('/licenses/:id', authenticateAdmin, deleteLicense);

router.get('/packages', authenticateAdmin, getPackages);
router.post('/packages', authenticateAdmin, addPackage);
router.put('/packages/:id', authenticateAdmin, updatePackage);
router.delete('/packages/:id', authenticateAdmin, deletePackage);
router.post('/otp/bind', authenticateAdmin, bindOtp);

export default router;
