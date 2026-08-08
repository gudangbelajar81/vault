import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

// Telegram Notifier
const sendTelegramNotification = async (message: string) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId || chatId === 'YOUR_CHAT_ID_HERE') return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
  } catch (error: any) {
    console.error('Telegram Notif Error:', error.message);
  }
};

export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'fallback-secret-ganti-di-produksi', { expiresIn: '12h' });
    await sendTelegramNotification(`✅ [LOGIN SUCCESS] CEO masuk ke License Manager dari IP: ${req.ip || 'Unknown'}`);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid Password' });
  }
};

export const generateLicense = async (req: Request, res: Response): Promise<void> => {
  const { client_name, app_code, wa_number, machine_id, tier, expiry_days, expiry_unit } = req.body;
  if (!machine_id || !tier || !client_name || !app_code) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    const pkg = await prisma.package.findUnique({ where: { tier_code: tier } });
    let featuresArr = [];
    try { featuresArr = JSON.parse(pkg?.features || '[]'); } catch (e) {}

    const privateKey = (process.env.PRIVATE_KEY || '').replace(/\\n/g, '\n');

    const payload = {
      app: app_code,
      hwid: machine_id,
      tier: tier,
      features: featuresArr,
      client: client_name
    };

    const jwtOptions: jwt.SignOptions = { algorithm: 'RS256' };
    if (expiry_days && !isNaN(expiry_days) && Number(expiry_days) > 0) {
      const multiplier = expiry_unit === 'minutes' ? 60 : 86400;
      jwtOptions.expiresIn = Number(expiry_days) * multiplier;
    }

    const licenseKey = jwt.sign(payload, privateKey, jwtOptions);

    await prisma.license.create({
      data: {
        client_name,
        app_code,
        wa_number: wa_number || '',
        machine_id,
        tier,
        license_key: licenseKey
      }
    });

    res.json({ key: licenseKey, message: 'Key generated and saved successfully!' });
  } catch (error: any) {
    console.error('Error generating key:', error);
    res.status(500).json({ error: 'Failed to generate key: ' + error.message });
  }
};

export const listLicenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.license.findMany({ orderBy: { created_at: 'desc' } });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch licenses' });
  }
};

export const deleteLicense = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.license.delete({ where: { id: parseInt(req.params.id as string) } });
    res.json({ message: 'License deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete license' });
  }
};

export const getPackages = async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.package.findMany({ orderBy: { price: 'asc' } });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
};

export const addPackage = async (req: Request, res: Response): Promise<void> => {
  const { tier_code, display_name, price, features } = req.body;
  const featuresStr = JSON.stringify(features || []);
  try {
    await prisma.package.create({
      data: { tier_code, display_name, price: Number(price), features: featuresStr }
    });
    res.json({ message: 'Package added' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add package' });
  }
};

export const updatePackage = async (req: Request, res: Response): Promise<void> => {
  const { tier_code, display_name, price, features } = req.body;
  const featuresStr = JSON.stringify(features || []);
  try {
    await prisma.package.update({
      where: { id: parseInt(req.params.id as string) },
      data: { tier_code, display_name, price: Number(price), features: featuresStr }
    });
    res.json({ message: 'Package updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update package' });
  }
};

export const deletePackage = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.package.delete({ where: { id: parseInt(req.params.id as string) } });
    res.json({ message: 'Package deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete package' });
  }
};

export const getPublicKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const privateKey = (process.env.PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
    res.json({ publicKey });
  } catch (error) {
    res.status(500).json({ error: 'Failed to export public key' });
  }
};

export const verifyLicense = async (req: Request, res: Response): Promise<void> => {
  const { machine_id, license_key } = req.body;
  if (!machine_id) { res.status(400).json({ error: 'machine_id required' }); return; }
  
  try {
    const privateKey = (process.env.PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });

    if (license_key) {
      try {
        const decoded: any = jwt.verify(license_key, publicKey, { algorithms: ['RS256'] });
        if (decoded.hwid && decoded.hwid !== machine_id) {
          res.status(403).json({ status: 'HWID_MISMATCH', message: 'Lisensi terikat ke perangkat lain.' });
          return;
        }
        res.json({ status: 'ACTIVE', message: 'Lisensi Valid', tier: decoded.tier, features: decoded.features });
        return;
      } catch (jwtErr) {
        res.status(403).json({ status: 'INVALID', message: 'Lisensi tidak valid atau kadaluarsa.' });
        return;
      }
    }

    const licenses = await prisma.license.findMany({
      where: { machine_id },
      orderBy: { id: 'desc' },
      take: 1
    });
    if (licenses.length === 0) {
      res.status(403).json({ status: 'REVOKED', message: 'Lisensi tidak ditemukan atau telah dicabut' });
      return;
    }
    
    try {
      const decoded: any = jwt.verify(licenses[0].license_key, publicKey, { algorithms: ['RS256'] });
      res.json({ status: 'ACTIVE', message: 'Lisensi Valid', tier: decoded.tier, features: decoded.features });
    } catch (jwtErr) {
      res.status(403).json({ status: 'EXPIRED', message: 'Lisensi Anda telah kedaluwarsa.' });
    }
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const requestOtp = async (req: Request, res: Response): Promise<void> => {
  const { machine_id, app_code } = req.body;
  if (!machine_id || !app_code) { res.status(400).json({ error: 'Missing machine_id or app_code' }); return; }
  
  try {
    const otp_code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expires_at = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await prisma.otp.create({
      data: { otp_code, machine_id, app_code, expires_at }
    });
    
    res.json({ otp_code, expires_in: '15 minutes' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to request OTP' });
  }
};

export const otpStatus = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') { res.status(400).json({ error: 'Code required' }); return; }
  
  try {
    const otp = await prisma.otp.findUnique({ where: { otp_code: code } });
    if (!otp) { res.status(404).json({ error: 'OTP not found' }); return; }
    
    if (new Date(otp.expires_at) < new Date() && otp.status === 'pending') {
      res.json({ status: 'expired' });
      return;
    }
    
    res.json({ 
      status: otp.status, 
      license_key: otp.status === 'bound' ? otp.license_key : null 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const bindOtp = async (req: Request, res: Response): Promise<void> => {
  const { otp_code, tier, client_name, expiry_days, expiry_unit } = req.body;
  if (!otp_code || !tier || !client_name) { res.status(400).json({ error: 'Missing fields' }); return; }
  
  try {
    const otp = await prisma.otp.findFirst({ where: { otp_code, status: 'pending' } });
    if (!otp) { res.status(404).json({ error: 'Valid OTP pending not found' }); return; }
    
    if (new Date(otp.expires_at) < new Date()) {
      res.status(400).json({ error: 'OTP has expired' }); return;
    }
    
    const pkg = await prisma.package.findUnique({ where: { tier_code: tier } });
    let featuresArr = [];
    try { featuresArr = JSON.parse(pkg?.features || '[]'); } catch (e) {}

    const privateKey = (process.env.PRIVATE_KEY || '').replace(/\\n/g, '\n');

    const payload = {
      app: otp.app_code,
      hwid: otp.machine_id,
      tier: tier,
      features: featuresArr,
      client: client_name
    };

    const jwtOptions: jwt.SignOptions = { algorithm: 'RS256' };
    if (expiry_days && !isNaN(expiry_days) && Number(expiry_days) > 0) {
      const multiplier = expiry_unit === 'minutes' ? 60 : 86400;
      jwtOptions.expiresIn = Number(expiry_days) * multiplier;
    }

    const licenseKey = jwt.sign(payload, privateKey, jwtOptions);

    await prisma.$transaction([
      prisma.license.create({
        data: {
          client_name,
          app_code: otp.app_code,
          machine_id: otp.machine_id,
          tier,
          license_key: licenseKey
        }
      }),
      prisma.otp.update({
        where: { id: otp.id },
        data: { status: 'bound', license_key: licenseKey }
      })
    ]);
    
    res.json({ message: 'OTP successfully bound and License activated!', key: licenseKey });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bind OTP' });
  }
};
