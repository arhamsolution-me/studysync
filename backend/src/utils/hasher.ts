import crypto from 'crypto';
import { argon2id, argon2Verify } from 'hash-wasm';

/**
 * Robust cross-platform password & token hasher using WebAssembly Argon2id.
 * Works seamlessly on Vercel Serverless, Linux Lambda, Windows, and local dev
 * without requiring native C++ node-gyp builds.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return await argon2id({
    password: plain,
    salt,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded',
  });
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    if (!storedHash || !plain) return false;
    if (storedHash.startsWith('$argon2')) {
      return await argon2Verify({
        password: plain,
        hash: storedHash,
      });
    }
    return false;
  } catch (err) {
    console.error('[Hasher] Error verifying password:', err);
    return false;
  }
}
