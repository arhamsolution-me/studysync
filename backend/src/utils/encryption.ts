import crypto from 'crypto';
import { config } from '../config';

/**
 * Military-grade AES-256-GCM Encryption Utility for User BYOK API Keys.
 * Provides confidentiality (256-bit encryption) and integrity (Auth Tag verification).
 */

// Derive or get 32-byte key from environment
function getMasterKey(): Buffer {
  const rawSecret = process.env.ENCRYPTION_MASTER_KEY || config.jwt.accessSecret || 'studysync_enterprise_master_key_default_32b!';
  // Hash to guaranteed 32 bytes (256 bits)
  return crypto.createHash('sha256').update(rawSecret).digest();
}

export interface EncryptedPayload {
  encryptedData: string; // hex
  iv: string;            // hex (16 bytes)
  authTag: string;       // hex (16 bytes)
}

/**
 * Encrypts an API key string using AES-256-GCM with a unique 16-byte random IV.
 */
export function encryptApiKey(plainKey: string): EncryptedPayload {
  if (!plainKey || typeof plainKey !== 'string') {
    throw new Error('API key to encrypt must be a non-empty string.');
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload back to the plain API key string.
 * Automatically verifies the auth tag; throws if ciphertext or tag was tampered with.
 */
export function decryptApiKey(encryptedData: string, iv: string, authTag: string): string {
  if (!encryptedData || !iv || !authTag) {
    throw new Error('Invalid encrypted payload: missing encryptedData, iv, or authTag.');
  }

  const key = getMasterKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a safe masked preview of an API key for display on the frontend.
 * Never leaks the full key secret.
 * Example: "AIzaSy...4X9Q" or "sk-proj...7b9Z"
 */
export function maskApiKey(plainKey: string): string {
  if (!plainKey) return '••••••••';
  const trimmed = plainKey.trim();
  if (trimmed.length <= 8) return '••••••••';
  if (trimmed.startsWith('sk-proj-')) {
    return `sk-proj-...${trimmed.slice(-4)}`;
  }
  if (trimmed.startsWith('gsk_')) {
    return `gsk_...${trimmed.slice(-4)}`;
  }
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}
