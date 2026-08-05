import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import vaultRoutes from './routes/vault';
import subscriptionRoutes from './routes/subscriptions';
import licenseManagerRoutes from './routes/licenseManager';

dotenv.config();

const app = express();

// WAJIB: Trust Proxy agar secure cookies dan rate-limiter bekerja di balik Nginx/Traefik/Reverse Proxy
app.set('trust proxy', 1);

// Security: Helmet (Mencegah celah seperti Clickjacking, XSS)
app.use(helmet());

// Security: Global Rate Limiting (Mencegah serangan DDoS umum)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  limit: 1000, // Maksimal 1000 request per 15 menit per IP
  message: { message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi nanti.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use(globalLimiter);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Backend is healthy!' });
});

// Pintu Tol Komunikasi (CORS) - Standar AlvezaDigital
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api', licenseManagerRoutes);

// Global Error Boundary (Halaman 500)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Terjadi Kesalahan Server', details: err.message });
});

// Dynamic PORT Mapping
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 VaultPro Backend berjalan di port ${PORT}`);
});
