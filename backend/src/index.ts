import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import vaultRoutes from './routes/vault';
import subscriptionRoutes from './routes/subscriptions';

dotenv.config();

const app = express();

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
