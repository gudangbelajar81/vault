/**
 * Utility for AES-256-GCM Encryption / Decryption using Web Crypto API.
 * Ensures Zero-Knowledge architecture: Server only receives the ciphertext.
 */
import localforage from 'localforage';

const ENCRYPTION_ITERATIONS = 100000;
const DEVICE_KEY_STORAGE_KEY = 'vp_device_crypto_key';

// Convert ArrayBuffer to Base64
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Convert Base64 to ArrayBuffer
const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

// Derive AES-GCM Key from Master Password and Salt
const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: ENCRYPTION_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptData = async (data: string, password: string): Promise<string> => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const enc = new TextEncoder();
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    enc.encode(data)
  );

  const saltB64 = bufferToBase64(salt.buffer);
  const ivB64 = bufferToBase64(iv.buffer);
  const cipherB64 = bufferToBase64(encrypted);

  // Format: salt:iv:ciphertext
  return `${saltB64}:${ivB64}:${cipherB64}`;
};

export const decryptData = async (encryptedString: string, password: string): Promise<string> => {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Format data terenkripsi tidak valid.');
  }

  const [saltB64, ivB64, cipherB64] = parts;
  
  const salt = new Uint8Array(base64ToBuffer(saltB64));
  const iv = new Uint8Array(base64ToBuffer(ivB64));
  const ciphertext = base64ToBuffer(cipherB64);

  const key = await deriveKey(password, salt);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
};

// ================= DEVICE-BOUND SECRET STORAGE =================
// Dipakai untuk menyimpan data sensitif ringan (misal: Master Password untuk
// fitur "Buka Cepat"/Biometrik) di IndexedDB TANPA plaintext. Key AES-GCM
// dibuat non-extractable (extractable: false) sehingga tidak bisa di-export
// keluar dari browser manapun kodenya dijalankan — hanya bisa dipakai untuk
// encrypt/decrypt di perangkat yang sama tempat key itu dibuat.
const getOrCreateDeviceKey = async (): Promise<CryptoKey> => {
  const existing = await localforage.getItem<CryptoKey>(DEVICE_KEY_STORAGE_KEY);
  if (existing) return existing;

  const newKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // extractable: false -> key tidak bisa di-dump/export
    ['encrypt', 'decrypt']
  );
  await localforage.setItem(DEVICE_KEY_STORAGE_KEY, newKey);
  return newKey;
};

/** Enkripsi string dengan key yang terikat ke perangkat ini (bukan terikat Master Password). */
export const encryptForDevice = async (plainText: string): Promise<string> => {
  const key = await getOrCreateDeviceKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText)
  );
  // Format: iv:ciphertext
  return `${bufferToBase64(iv.buffer)}:${bufferToBase64(encrypted)}`;
};

/** Dekripsi string yang sebelumnya dienkripsi dengan encryptForDevice(). */
export const decryptForDevice = async (encoded: string): Promise<string> => {
  const parts = encoded.split(':');
  if (parts.length !== 2) {
    throw new Error('Format data perangkat tidak valid.');
  }
  const [ivB64, cipherB64] = parts;
  const key = await getOrCreateDeviceKey();
  const iv = new Uint8Array(base64ToBuffer(ivB64));
  const ciphertext = base64ToBuffer(cipherB64);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  const dec = new TextDecoder();
  return dec.decode(decrypted);
};

