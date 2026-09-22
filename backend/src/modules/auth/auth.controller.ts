import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authService } from './auth.service';
import { AuthRequest } from '../../middleware/authGuard';
import { config } from '../../config';

class AuthController {
  /**
   * POST /api/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);

      if (result.requiresVerification) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            requiresVerification: true,
            email: result.email,
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Welcome to StudySync! Your account is ready.',
        data: {
          user: (result as any).user,
          accessToken: (result as any).accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/verify-otp
   */
  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const email = req.body.email;
      const otp = req.body.otp || req.body.otpCode;
      if (!email || !otp) {
        res.status(400).json({ success: false, message: 'Email and 6-digit OTP code are required.' });
        return;
      }

      const result = await authService.verifyOtp(email, otp);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/resend-otp
   */
  async resendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: 'Email is required.' });
        return;
      }

      const result = await authService.resendOtp(email);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result: any = await authService.login(req.body);

      if (result.requiresVerification) {
        res.status(200).json({
          success: false,
          requiresVerification: true,
          email: result.email,
          message: result.message,
        });
        return;
      }

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        message: 'Welcome back!',
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: 'Email is required.' });
        return;
      }

      const result = await authService.requestPasswordReset(email);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Email, reset code, and new password are required.',
        });
        return;
      }

      const result = await authService.resetPassword(email, otp, newPassword);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: 'Refresh token missing. Please log in.',
        });
        return;
      }

      const result = await authService.refreshTokens(refreshToken);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.userId) {
        await authService.logout(req.userId);
      }

      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/api/auth' });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   */
  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await authService.getProfile(req.userId!);

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/auth/profile
   */
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const {
        fullName,
        email,
        reminderLeadTimeMins,
        whatsappNumber,
        avatarUrl,
        university,
        major,
        semester,
        plan,
        aiProviderPreference,
        activeByokProvider,
      } = req.body;

      if (!req.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const user = await authService.updateProfile(req.userId, {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(reminderLeadTimeMins !== undefined ? { reminderLeadTimeMins: Number(reminderLeadTimeMins) } : {}),
        ...(whatsappNumber !== undefined ? { whatsappNumber } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(university !== undefined ? { university } : {}),
        ...(major !== undefined ? { major } : {}),
        ...(semester !== undefined ? { semester } : {}),
        ...(plan !== undefined ? { plan } : {}),
        ...(aiProviderPreference !== undefined ? { aiProviderPreference } : {}),
        ...(activeByokProvider !== undefined ? { activeByokProvider } : {}),
      });

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/onboarding/complete
   */
  async completeOnboarding(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const {
        university,
        major,
        semester,
        plan,
        aiProviderPreference,
        activeByokProvider,
      } = req.body;

      const user = await authService.completeOnboarding(req.userId, {
        university,
        major,
        semester,
        plan: plan || 'free',
        aiProviderPreference: aiProviderPreference || 'system',
        activeByokProvider,
      });

      res.status(200).json({
        success: true,
        message: 'Onboarding completed successfully! Welcome to StudySync AI.',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
