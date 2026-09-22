import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authGuard';
import prisma from '../../config/database';
import { encryptApiKey, maskApiKey } from '../../utils/encryption';

class ApiKeyController {
  /**
   * Validate key against external AI provider
   */
  private async validateProviderKey(provider: string, key: string): Promise<{ valid: boolean; error?: string }> {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return { valid: false, error: 'API key cannot be empty' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmedKey)}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          return { valid: true };
        }
        const data: any = await res.json().catch(() => ({}));
        return {
          valid: false,
          error: data?.error?.message || `Google Gemini rejected key (HTTP ${res.status})`,
        };
      }

      if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: {
            Authorization: `Bearer ${trimmedKey}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          return { valid: true };
        }
        const data: any = await res.json().catch(() => ({}));
        return {
          valid: false,
          error: data?.error?.message || `Groq rejected key (HTTP ${res.status})`,
        };
      }

      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${trimmedKey}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          return { valid: true };
        }
        const data: any = await res.json().catch(() => ({}));
        return {
          valid: false,
          error: data?.error?.message || `OpenAI rejected key (HTTP ${res.status})`,
        };
      }

      clearTimeout(timeout);
      return { valid: false, error: `Unsupported provider: ${provider}` };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return { valid: false, error: 'Provider validation timed out after 8s.' };
      }
      return { valid: false, error: err.message || 'Network error during validation' };
    }
  }

  /**
   * POST /api/user/keys/test
   * Test an API key without saving it
   */
  async testKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { provider, key } = req.body;
      if (!provider || !key) {
        res.status(400).json({
          success: false,
          message: 'Provider and key are required.',
        });
        return;
      }

      const normalizedProvider = provider.toLowerCase();
      const validation = await this.validateProviderKey(normalizedProvider, key);

      if (!validation.valid) {
        res.status(400).json({
          success: false,
          message: validation.error || 'Invalid API key.',
          provider: normalizedProvider,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `${normalizedProvider.toUpperCase()} key verified and active!`,
        provider: normalizedProvider,
        maskedKey: maskApiKey(key),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/user/keys
   * Encrypt and store user's BYOK API key
   */
  async saveKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || 'personal-user';
      const { provider, key, setAsActive = true } = req.body;

      if (!provider || !key) {
        res.status(400).json({
          success: false,
          message: 'Provider and key are required.',
        });
        return;
      }

      const normalizedProvider = provider.toLowerCase();
      if (!['gemini', 'groq', 'openai'].includes(normalizedProvider)) {
        res.status(400).json({
          success: false,
          message: 'Provider must be one of: gemini, groq, openai',
        });
        return;
      }

      // Live verification
      const validation = await this.validateProviderKey(normalizedProvider, key);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          message: validation.error || 'Key validation failed with provider.',
        });
        return;
      }

      // Encrypt with military-grade AES-256-GCM
      const encrypted = encryptApiKey(key);
      const maskedKey = maskApiKey(key);

      const saved = await prisma.userApiKey.upsert({
        where: {
          userId_provider: {
            userId,
            provider: normalizedProvider as any,
          },
        },
        update: {
          encryptedData: encrypted.encryptedData,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          maskedKey,
          isValid: true,
          lastTestedAt: new Date(),
        },
        create: {
          userId,
          provider: normalizedProvider as any,
          encryptedData: encrypted.encryptedData,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          maskedKey,
          isValid: true,
          lastTestedAt: new Date(),
        },
      });

      // Optionally set preference
      if (setAsActive) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            aiProviderPreference: 'byok',
            activeByokProvider: normalizedProvider as any,
          },
        });
      }

      res.status(200).json({
        success: true,
        message: `${normalizedProvider.toUpperCase()} API key safely encrypted and activated.`,
        data: {
          id: saved.id,
          provider: saved.provider,
          maskedKey: saved.maskedKey,
          isValid: saved.isValid,
          lastTestedAt: saved.lastTestedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/user/keys
   * List all stored keys (masked only, never plaintext) and current preference
   */
  async listKeys(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || 'personal-user';

      const [user, keys] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            aiProviderPreference: true,
            activeByokProvider: true,
            plan: true,
          },
        }),
        prisma.userApiKey.findMany({
          where: { userId },
        }),
      ]);

      const safeKeys = keys.map((k: any) => ({
        id: k.id,
        provider: k.provider,
        maskedKey: k.maskedKey,
        isValid: k.isValid,
        lastTestedAt: k.lastTestedAt,
        createdAt: k.createdAt,
      }));

      res.status(200).json({
        success: true,
        data: {
          aiProviderPreference: user?.aiProviderPreference || 'system',
          activeByokProvider: user?.activeByokProvider || null,
          plan: user?.plan || 'free',
          keys: safeKeys,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/user/keys/preference
   * Switch between system pool and BYOK provider
   */
  async setPreference(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || 'personal-user';
      const { aiProviderPreference, activeByokProvider } = req.body;

      if (aiProviderPreference && !['system', 'byok'].includes(aiProviderPreference)) {
        res.status(400).json({
          success: false,
          message: "Preference must be either 'system' or 'byok'.",
        });
        return;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(aiProviderPreference ? { aiProviderPreference } : {}),
          ...(activeByokProvider !== undefined ? { activeByokProvider: activeByokProvider as any } : {}),
        },
      });

      res.status(200).json({
        success: true,
        message: 'AI Provider preferences updated.',
        data: {
          aiProviderPreference: updated.aiProviderPreference,
          activeByokProvider: updated.activeByokProvider,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/user/keys/:provider
   * Delete a stored key
   */
  async deleteKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || 'personal-user';
      const providerParam = String(req.params.provider || '').toLowerCase();

      await prisma.userApiKey.deleteMany({
        where: {
          userId,
          provider: providerParam as any,
        },
      });

      // If user had this as active BYOK provider, check if other keys exist
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.activeByokProvider === providerParam) {
        const remaining = await prisma.userApiKey.findMany({ where: { userId } });
        await prisma.user.update({
          where: { id: userId },
          data: {
            activeByokProvider: remaining.length > 0 ? (remaining[0].provider as any) : null,
            aiProviderPreference: remaining.length > 0 ? 'byok' : 'system',
          },
        });
      }

      res.status(200).json({
        success: true,
        message: `${providerParam.toUpperCase()} API key removed.`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const apiKeyController = new ApiKeyController();
