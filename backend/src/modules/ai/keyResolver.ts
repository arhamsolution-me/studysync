import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../../config/database';
import { decryptApiKey } from '../../utils/encryption';
import { config } from '../../config';

// System fallback pool
const geminiKeys: string[] = (config.gemini as any).keys?.length
  ? (config.gemini as any).keys
  : config.gemini.apiKey
    ? [config.gemini.apiKey]
    : [];

let currentGeminiKeyIdx = 0;

export function getSystemGeminiClient(): GoogleGenerativeAI | null {
  if (geminiKeys.length === 0) return null;
  const key = geminiKeys[currentGeminiKeyIdx % geminiKeys.length];
  currentGeminiKeyIdx++;
  return new GoogleGenerativeAI(key);
}

const groqKeys: string[] = (config.groq as any).keys?.length
  ? (config.groq as any).keys
  : config.groq.apiKey
    ? [config.groq.apiKey]
    : [];

let currentGroqKeyIdx = 0;

export function getSystemGroqClient(): Groq | null {
  if (groqKeys.length === 0) return null;
  const key = groqKeys[currentGroqKeyIdx % groqKeys.length];
  currentGroqKeyIdx++;
  return new Groq({ apiKey: key });
}

export interface ResolvedAIClient {
  isByok: boolean;
  provider: 'groq' | 'gemini' | 'openai' | 'system';
  groqClient?: Groq | null;
  geminiClient?: GoogleGenerativeAI | null;
  apiKey?: string;
}

/**
 * Dynamically resolves whether to use a user's encrypted BYOK key or the platform system pool.
 */
export async function resolveAIClientForUser(
  userId: string,
  preferredProvider?: 'gemini' | 'openai' | 'groq'
): Promise<ResolvedAIClient> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        aiProviderPreference: true,
        activeByokProvider: true,
      },
    });

    if (user?.aiProviderPreference === 'byok') {
      const targetProvider = preferredProvider || user.activeByokProvider || 'groq';
      const keyRecord = await prisma.userApiKey.findFirst({
        where: {
          userId,
          provider: targetProvider as any,
          isValid: true,
        },
      });

      if (keyRecord && keyRecord.encryptedData && keyRecord.iv && keyRecord.authTag) {
        try {
          const decryptedKey = decryptApiKey(
            keyRecord.encryptedData,
            keyRecord.iv,
            keyRecord.authTag
          );

          if (targetProvider === 'gemini') {
            return {
              isByok: true,
              provider: 'gemini',
              geminiClient: new GoogleGenerativeAI(decryptedKey),
              apiKey: decryptedKey,
            };
          }

          if (targetProvider === 'groq') {
            return {
              isByok: true,
              provider: 'groq',
              groqClient: new Groq({ apiKey: decryptedKey }),
              apiKey: decryptedKey,
            };
          }

          if (targetProvider === 'openai') {
            return {
              isByok: true,
              provider: 'openai',
              apiKey: decryptedKey,
            };
          }
        } catch (decryptErr) {
          console.error(`[AI KeyResolver] Decryption error for user ${userId}:`, decryptErr);
          // Fall back to system pool
        }
      }
    }
  } catch (err) {
    console.warn(`[AI KeyResolver] Could not fetch user key settings:`, err);
  }

  // Fallback to platform managed pool
  return {
    isByok: false,
    provider: 'system',
    groqClient: getSystemGroqClient(),
    geminiClient: getSystemGeminiClient(),
  };
}
