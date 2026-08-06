import express, { Request, Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import prisma from '../utils/prisma';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Configuration
const rpName = 'VaultPro';
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-ganti-di-produksi';

// Middleware to extract user from session (Assuming cookie 'token')
const requireAuth = async (req: Request, res: Response, next: express.NextFunction) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    
    // Attach user to req
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * 1. Generate Registration Options (Requires Login first)
 */
router.get('/generate-registration-options', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get existing credentials for this user
    const userCredentials = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id }
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: user.email,
      // Don't prompt users for their authenticator if they already registered it
      excludeCredentials: userCredentials.map(cred => ({
        id: new Uint8Array(Buffer.from(cred.credentialId, 'base64url')),
        type: 'public-key',
        transports: cred.transports ? (JSON.parse(cred.transports) as any) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform', // Enforce on-device (FaceID/TouchID/Windows Hello)
      },
    });

    // Save challenge to user
    await prisma.user.update({
      where: { id: user.id },
      data: { currentChallenge: options.challenge }
    });

    res.json({ success: true, data: options });
  } catch (error: any) {
    console.error('generateRegistrationOptions error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate registration options', details: error.message });
  }
});

/**
 * 2. Verify Registration
 */
router.post('/verify-registration', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { response, deviceName } = req.body;
    
    const expectedChallenge = user.currentChallenge;
    
    if (!expectedChallenge) {
      return res.status(400).json({ success: false, message: 'No challenge found' });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({ success: false, message: error.message });
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = registrationInfo;

      // Save the new credential
      await prisma.webAuthnCredential.create({
        data: {
          userId: user.id,
          credentialId: Buffer.from(credentialID).toString('base64url'),
          publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
          counter: counter,
          transports: JSON.stringify(response.response.transports || []),
          deviceName: deviceName || 'Biometric Device',
        }
      });

      // Clear challenge
      await prisma.user.update({
        where: { id: user.id },
        data: { currentChallenge: null }
      });

      return res.json({ success: true, message: 'Device registered successfully' });
    }

    res.status(400).json({ success: false, message: 'Verification failed' });
  } catch (error: any) {
    console.error('verifyRegistration error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify registration', details: error.message });
  }
});

/**
 * 3. Generate Authentication Options (Public Route - No Login Required)
 */
router.post('/generate-authentication-options', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required for biometric login' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userCredentials = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id }
    });

    if (userCredentials.length === 0) {
      return res.status(400).json({ success: false, message: 'No biometric devices registered for this account' });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userCredentials.map(cred => ({
        id: new Uint8Array(Buffer.from(cred.credentialId, 'base64url')),
        type: 'public-key',
        transports: cred.transports ? (JSON.parse(cred.transports) as any) : undefined,
      })),
      userVerification: 'preferred',
    });

    // Save challenge
    await prisma.user.update({
      where: { id: user.id },
      data: { currentChallenge: options.challenge }
    });

    res.json({ success: true, data: options });
  } catch (error: any) {
    console.error('generateAuthenticationOptions error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate authentication options', details: error.message });
  }
});

/**
 * 4. Verify Authentication
 */
router.post('/verify-authentication', async (req: Request, res: Response) => {
  try {
    const { email, response } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const expectedChallenge = user.currentChallenge;
    if (!expectedChallenge) {
      return res.status(400).json({ success: false, message: 'No challenge found' });
    }

    // Find the credential
    const credentialId = response.id;
    const authenticator = await prisma.webAuthnCredential.findUnique({
      where: { credentialId }
    });

    if (!authenticator) {
      return res.status(400).json({ success: false, message: 'Authenticator is not registered with this site' });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: new Uint8Array(Buffer.from(authenticator.credentialId, 'base64url')),
          credentialPublicKey: new Uint8Array(Buffer.from(authenticator.publicKey, 'base64url')),
          counter: Number(authenticator.counter),
        },
      });
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({ success: false, message: error.message });
    }

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // Update counter and lastUsed
      await prisma.webAuthnCredential.update({
        where: { id: authenticator.id },
        data: { 
          counter: authenticationInfo.newCounter,
          lastUsed: new Date()
        }
      });

      // Clear challenge
      await prisma.user.update({
        where: { id: user.id },
        data: { currentChallenge: null }
      });

      // Issue JWT token (Login successful)
      const payload = { id: user.id };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

      // Save session
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
          deviceInfo: req.headers['user-agent'] || 'Unknown WebAuthn Device',
          ipAddress: req.ip || 'Unknown',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.json({ success: true, message: 'Authentication successful', data: { user: { id: user.id, email: user.email } } });
    }

    res.status(400).json({ success: false, message: 'Authentication verification failed' });
  } catch (error: any) {
    console.error('verifyAuthentication error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify authentication', details: error.message });
  }
});

// Get registered devices
router.get('/devices', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const devices = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        deviceName: true,
        lastUsed: true,
        createdAt: true,
      }
    });
    res.json({ success: true, data: devices });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch devices', details: error.message });
  }
});

// Delete a device
router.delete('/devices/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const deviceId = req.params.id as string;
    
    await prisma.webAuthnCredential.deleteMany({
      where: { 
        id: deviceId,
        userId: user.id // Ensure they only delete their own
      }
    });
    
    res.json({ success: true, message: 'Device deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete device', details: error.message });
  }
});

export default router;
