import { hashPassword, verifyPassword } from '../../utils/hasher';
import jwt from 'jsonwebtoken';
import prisma, { loadUserSettings } from '../../config/database';
import { config } from '../../config';
import { emailService } from '../notifications/email.service';
import { RegisterInput, LoginInput } from './auth.schema';

function generate6DigitOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

class AuthService {
  /**
   * Register a new student account with Argon2id password hashing and email OTP.
   */
  async register(input: RegisterInput) {
    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      if (!existing.isVerified) {
        // Unverified existing account: refresh OTP and allow verification
        const otpCode = generate6DigitOtp();
        const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await prisma.user.update({
          where: { id: existing.id },
          data: { otpCode, otpExpiresAt } as any,
        });
        await emailService.sendVerificationOtpEmail(input.email, otpCode, input.fullName);
        return {
          requiresVerification: true,
          email: input.email,
          message: 'An unverified account exists. A fresh verification code has been sent to your email.',
        };
      }
      throw Object.assign(new Error('An account with this email already exists.'), {
        statusCode: 409,
      });
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(input.password);

    // Generate 6-digit verification OTP (15 min validity)
    const otpCode = generate6DigitOtp();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Create user (unverified by default until OTP is entered)
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash,
        isVerified: false,
        otpCode,
        otpExpiresAt,
      } as any,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    // Send verification OTP email via live SMTP
    await emailService.sendVerificationOtpEmail(input.email, otpCode, input.fullName);

    return {
      requiresVerification: true,
      email: user.email,
      message: 'Account created! Please check your email for the 6-digit verification code.',
    };
  }

  /**
   * Verify email with 6-digit OTP and issue JWT session tokens.
   */
  async verifyOtp(email: string, otp: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw Object.assign(new Error('No account found with this email.'), { statusCode: 404 });
    }

    if (user.isVerified) {
      const tokens = this.generateTokens(user.id, user.role);
      await this.storeRefreshToken(user.id, tokens.refreshToken);
      const { passwordHash: _, ...safeUser } = user;
      return { user: safeUser, ...tokens, message: 'Account is already verified.' };
    }

    if (!user.otpCode || user.otpCode.trim() !== otp.trim()) {
      throw Object.assign(new Error('Invalid verification code. Please check your email.'), {
        statusCode: 400,
      });
    }

    if (user.otpExpiresAt && new Date() > new Date(user.otpExpiresAt)) {
      throw Object.assign(
        new Error('Verification code has expired. Please click resend code.'),
        { statusCode: 400 }
      );
    }

    // Mark verified
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
      } as any,
    });

    const tokens = this.generateTokens(updated.id, updated.role);
    await this.storeRefreshToken(updated.id, tokens.refreshToken);

    const { passwordHash: _, ...safeUser } = updated;
    return {
      user: safeUser,
      ...tokens,
      message: 'Email verified successfully! Welcome to StudySync AI.',
    };
  }

  /**
   * Resend 6-digit verification OTP.
   */
  async resendOtp(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw Object.assign(new Error('No account found with this email.'), { statusCode: 404 });
    }

    if (user.isVerified) {
      return { success: true, message: 'Account is already verified.' };
    }

    const otpCode = generate6DigitOtp();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode, otpExpiresAt } as any,
    });

    await emailService.sendVerificationOtpEmail(user.email, otpCode, user.fullName);

    return {
      success: true,
      message: 'A fresh 6-digit verification code has been sent to your email.',
    };
  }

  /**
   * Login with email and password. Returns JWT pair or triggers verification OTP if unverified.
   */
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        passwordHash: true,
        isVerified: true,
        isOnboarded: true,
        plan: true,
        aiProviderPreference: true,
        activeByokProvider: true,
        createdAt: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw Object.assign(
        new Error('Invalid email or password.'),
        { statusCode: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw Object.assign(
        new Error('Invalid email or password.'),
        { statusCode: 401 }
      );
    }

    // Check account suspension status
    if ((user as any).isBlocked) {
      throw Object.assign(
        new Error('Your account has been suspended by the administrator. Please contact support.'),
        { statusCode: 403 }
      );
    }

    // Check verification status
    if (user.isVerified === false) {
      const otpCode = generate6DigitOtp();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode, otpExpiresAt } as any,
      });
      await emailService.sendVerificationOtpEmail(user.email, otpCode, user.fullName);

      return {
        requiresVerification: true,
        email: user.email,
        message: 'Your email is not verified yet. A verification code has been sent to your email.',
      };
    }

    // Generate token pair
    const tokens = this.generateTokens(user.id, user.role);

    // Store new refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    const { passwordHash, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  /**
   * Request Password Reset OTP via Email.
   */
  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const otpCode = generate6DigitOtp();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.passwordReset.create({
        data: {
          email: user.email,
          otpCode,
          expiresAt,
          used: false,
        } as any,
      });

      await emailService.sendPasswordResetOtpEmail(user.email, otpCode, user.fullName);
    }

    return {
      success: true,
      message: 'If an account exists with this email, a 6-digit reset code has been sent.',
    };
  }

  /**
   * Reset Password with OTP verification.
   */
  async resetPassword(email: string, otp: string, newPassword: string) {
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        email,
        otpCode: otp.trim(),
        used: false,
      },
    });

    if (!resetRecord) {
      throw Object.assign(new Error('Invalid or expired reset code.'), { statusCode: 400 });
    }

    if (new Date() > new Date(resetRecord.expiresAt)) {
      throw Object.assign(new Error('Reset code has expired. Please request a new one.'), {
        statusCode: 400,
      });
    }

    const passwordHash = await hashPassword(newPassword);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw Object.assign(new Error('User not found.'), { statusCode: 404 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash } as any,
    });

    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { used: true } as any,
    });

    return {
      success: true,
      message: 'Password updated successfully! You can now log in with your new password.',
    };
  }

  /**
   * Refresh tokens using a valid refresh token.
   * Implements rotation: old token is invalidated, new pair is issued.
   */
  async refreshTokens(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as {
        userId: string;
        role: string;
      };

      // Verify the refresh token matches what's stored (rotation check)
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          refreshToken: true,
        },
      });

      if (!user || !user.refreshToken) {
        throw Object.assign(new Error('Invalid refresh token.'), { statusCode: 401 });
      }

      // Verify stored token matches (detect reuse of old tokens)
      const storedTokenValid = await verifyPassword(user.refreshToken, refreshToken);
      if (!storedTokenValid) {
        // Possible token theft — invalidate all sessions
        await prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
        throw Object.assign(
          new Error('Security alert: your session was invalidated. Please log in again.'),
          { statusCode: 401 }
        );
      }

      // Issue new token pair (rotation)
      const tokens = this.generateTokens(user.id, user.role);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      const { refreshToken: _, ...safeUser } = user;
      return { user: safeUser, ...tokens };
    } catch (error: any) {
      if (error.statusCode) throw error;
      throw Object.assign(new Error('Session expired. Please log in again.'), {
        statusCode: 401,
      });
    }
  }

  /**
   * Logout: Invalidate refresh token.
   */
  async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  /**
   * Get current user profile.
   */
  async getProfile(userId: string) {
    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          whatsappNumber: true,
          reminderLeadTimeMins: true,
          googleOauthId: true,
          avatarUrl: true,
          university: true,
          major: true,
          semester: true,
          isOnboarded: true,
          plan: true,
          aiProviderPreference: true,
          activeByokProvider: true,
          createdAt: true,
        },
      });
    } catch {
      user = null;
    }

    if (!user) {
      const settings = loadUserSettings();
      return {
        id: userId || 'personal-user',
        fullName: settings.fullName || 'Personal Student',
        email: settings.email || 'devnexes.support@gmail.com',
        role: 'student',
        whatsappNumber: settings.whatsappNumber || null,
        reminderLeadTimeMins: settings.reminderLeadTimeMins || 1440,
        googleOauthId: null,
        hasGoogleConnected: false,
        avatarUrl: null,
        university: 'University of Management and Technology',
        major: 'Software Engineering',
        semester: '6th Semester',
        isOnboarded: true,
        plan: 'pro',
        aiProviderPreference: 'system',
        activeByokProvider: null,
        createdAt: new Date(),
      };
    }

    return {
      ...user,
      hasGoogleConnected: !!user.googleOauthId,
    };
  }

  /**
   * Update user profile / settings (e.g. notification email, reminder lead time, university, etc.).
   */
  async updateProfile(userId: string, data: {
    fullName?: string;
    email?: string;
    reminderLeadTimeMins?: number;
    whatsappNumber?: string;
    avatarUrl?: string;
    university?: string;
    major?: string;
    semester?: string;
    isOnboarded?: boolean;
    plan?: any;
    aiProviderPreference?: string;
    activeByokProvider?: any;
  }) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: data as any,
    });
    return {
      ...updated,
      hasGoogleConnected: !!updated.googleOauthId,
    };
  }

  /**
   * Complete onboarding wizard setup for user.
   */
  async completeOnboarding(userId: string, data: {
    university?: string;
    major?: string;
    semester?: string;
    plan?: any;
    aiProviderPreference?: string;
    activeByokProvider?: any;
  }) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        isOnboarded: true,
      } as any,
    });
    return {
      ...updated,
      hasGoogleConnected: !!updated.googleOauthId,
    };
  }

  // ─── Private Helpers ─────────────────────────────────

  private generateTokens(userId: string, role: string) {
    const accessToken = jwt.sign(
      { userId, role },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn as any }
    );

    const refreshToken = jwt.sign(
      { userId, role },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as any }
    );

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    // Store hash of refresh token (never store raw tokens in DB)
    const tokenHash = await hashPassword(refreshToken);

    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: tokenHash },
    });
  }
}

export const authService = new AuthService();
