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
import webauthnRoutes from './routes/webauthn';
import expenseRoutes from './routes/expenses';

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

// Version Check Endpoint
app.get('/api/version', (req, res) => {
  res.status(200).json({ version: '1.0.6', buildTime: 1740588000000 });
});

// Logs Endpoint for Debugging VPS
app.get('/api/logs', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const logPath = path.resolve('../api.log');
  if (fs.existsSync(logPath)) {
    res.sendFile(logPath);
  } else {
    res.status(404).send('Log file not found at ' + logPath);
  }
});

// Pintu Tol Komunikasi (CORS) - Standar AlvezaDigital
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'https://vault.novuq.com'
].filter(Boolean) as string[];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webauthn', webauthnRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/expenses', expenseRoutes);
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
