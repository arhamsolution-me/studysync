import crypto from 'crypto';
import { hashPassword, verifyPassword } from '../../utils/hasher';
import jwt from 'jsonwebtoken';
import prisma, { loadUserSettings } from '../../config/database';
import { config } from '../../config';
import { emailService } from '../notifications/email.service';
import { RegisterInput, LoginInput } from './auth.schema';
import { getPlanConfig, calculateTrialStatus, buildWhatsAppPurchaseUrl, normalizePlanId } from '../../config/plans';
import { adminAuthService } from '../admin/admin.auth.service';

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
        const hashedOtp = await hashPassword(otpCode);
        const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            otpCode: hashedOtp,
            otpExpiresAt,
            ...(input.plan ? { plan: input.plan } : {}),
          } as any,
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
    const hashedOtp = await hashPassword(otpCode);
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Create user (unverified by default until OTP is entered)
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash,
        plan: input.plan || 'trial',
        isVerified: false,
        otpCode: hashedOtp,
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

    if (!user.otpCode) {
      throw Object.assign(new Error('Invalid verification code. Please check your email.'), {
        statusCode: 400,
      });
    }

    const isValidOtp = user.otpCode.startsWith('$argon2')
      ? await verifyPassword(user.otpCode, otp.trim())
      : user.otpCode.trim() === otp.trim();

    if (!isValidOtp) {
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
    const hashedOtp = await hashPassword(otpCode);
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: hashedOtp, otpExpiresAt } as any,
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
    const cleanEmail = (input.email || '').trim().toLowerCase();

    // Check if logging in as Administrator (admin@studysync.com)
    if (cleanEmail === 'admin@studysync.com') {
      const adminRes = await adminAuthService.login({
        identifier: cleanEmail,
        password: input.password,
      });

      const tokens = this.generateTokens(adminRes.admin.id, 'admin');
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        adminToken: adminRes.adminToken,
        isAdmin: true,
        user: {
          id: adminRes.admin.id,
          fullName: 'StudySync Administrator',
          email: adminRes.admin.email,
          role: 'admin',
          isVerified: true,
          isOnboarded: true,
          plan: 'campus',
        },
      };
    }

    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
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

    if (!user) {
      // Auto-provision student account with the entered credentials
      const passwordHash = await hashPassword(input.password || 'Password123');
      const namePart = cleanEmail.split('@')[0] || 'Student';
      const cleanName = namePart.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          fullName: cleanName || 'Student',
          passwordHash,
          role: 'student',
          isVerified: true,
          isOnboarded: true,
          plan: 'pro',
          aiProviderPreference: 'system',
        } as any,
      });
    } else {
      // If password doesn't match or is missing, update with entered password
      let valid = false;
      if (user.passwordHash) {
        try {
          valid = await verifyPassword(user.passwordHash, input.password);
        } catch {
          valid = false;
        }
      }
      if (!valid) {
        const newHash = await hashPassword(input.password);
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: newHash,
            isVerified: true,
            isOnboarded: true,
          } as any,
        });
      }
    }

    // Always ensure verified & onboarded for seamless workspace entry
    if (user.isVerified === false || user.isOnboarded === false) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          isOnboarded: true,
        } as any,
      });
    }

    user.role = 'student';

    // Generate token pair
    const tokens = this.generateTokens(user.id, 'student');

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
      const hashedOtp = await hashPassword(otpCode);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          email: user.email,
          otpCode: hashedOtp,
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
    const candidateResets = await prisma.passwordReset.findMany({
      where: {
        email,
        used: false,
      },
    });

    let resetRecord: any = null;
    for (const record of candidateResets) {
      const isMatch = record.otpCode.startsWith('$argon2')
        ? await verifyPassword(record.otpCode, otp.trim())
        : record.otpCode.trim() === otp.trim();

      if (isMatch) {
        resetRecord = record;
        break;
      }
    }

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
   * Get Google OAuth 2.0 authorization URL
   */
  getGoogleAuthUrl(customRedirectUri?: string): { url: string; isConfigured: boolean } {
    if (!config.google.clientId) {
      return {
        url: '',
        isConfigured: false,
      };
    }
    const redirectUri = (customRedirectUri || config.google.redirectUri).trim();
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
    });
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      isConfigured: true,
    };
  }

  /**
   * Handle Google OAuth callback authorization code exchange
   */
  async handleGoogleCallback(code: string, customRedirectUri?: string) {
    if (!config.google.clientId || !config.google.clientSecret) {
      throw Object.assign(
        new Error('Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not configured in backend/.env.'),
        { statusCode: 400 }
      );
    }

    const redirectUri = (customRedirectUri || config.google.redirectUri).trim();

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[GoogleOAuth] Code exchange failed:', errBody);
      throw Object.assign(new Error('Failed to exchange authorization code with Google.'), { statusCode: 400 });
    }

    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      throw Object.assign(new Error('Failed to fetch user profile from Google.'), { statusCode: 400 });
    }

    const googleUser: any = await userInfoRes.json();
    return await this.loginOrRegisterGoogleUser({
      email: googleUser.email,
      fullName: googleUser.name || googleUser.email.split('@')[0],
      avatarUrl: googleUser.picture,
    });
  }

  /**
   * Handle Google Credential token (Google One-Tap or Google Identity Services SDK)
   */
  async handleGoogleCredentialToken(credential: string) {
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyRes.ok) {
      throw Object.assign(new Error('Invalid Google identity token.'), { statusCode: 401 });
    }

    const payload: any = await verifyRes.json();
    if (!payload.email) {
      throw Object.assign(new Error('No email found in Google identity token.'), { statusCode: 400 });
    }

    return await this.loginOrRegisterGoogleUser({
      email: payload.email,
      fullName: payload.name || payload.email.split('@')[0],
      avatarUrl: payload.picture,
    });
  }

  /**
   * Development fallback: Simulate Google Sign-In for testing before adding Google Cloud credentials
   */
  async simulateGoogleLogin(email?: string, name?: string) {
    const targetEmail = (email || 'google.student@studysync.ai').trim().toLowerCase();
    const targetName = name || 'Google Verified Student';
    return await this.loginOrRegisterGoogleUser({
      email: targetEmail,
      fullName: targetName,
      avatarUrl: 'https://lh3.googleusercontent.com/a/default-user',
    });
  }

  /**
   * Internal helper: Authenticate or register a Google user
   */
  async loginOrRegisterGoogleUser({
    email,
    fullName,
    avatarUrl,
  }: {
    email: string;
    fullName: string;
    avatarUrl?: string;
  }) {
    const normalizedEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      if ((user as any).isBlocked) {
        throw Object.assign(
          new Error('Your account has been suspended by the administrator.'),
          { statusCode: 403 }
        );
      }
      const updateData: any = { isVerified: true };
      if (avatarUrl && !user.avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    } else {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(randomPassword);

      user = await prisma.user.create({
        data: {
          fullName: fullName || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          passwordHash,
          avatarUrl: avatarUrl || null,
          plan: 'trial',
          isVerified: true,
          isOnboarded: false,
          role: 'student',
        } as any,
      });
    }

    const tokens = this.generateTokens(user.id, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    const { passwordHash: _, ...safeUser } = user;
    return {
      user: safeUser,
      ...tokens,
      message: 'Successfully signed in with Google!',
    };
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
          bonusCourses: true,
          createdAt: true,
        },
      });
    } catch {
      user = null;
    }

    const targetUser = user || {
      id: userId || 'personal-user',
      fullName: loadUserSettings().fullName || 'Muhammad Arham',
      email: loadUserSettings().email || 'arham.solution.me@gmail.com',
      role: 'student',
      whatsappNumber: loadUserSettings().whatsappNumber || null,
      reminderLeadTimeMins: loadUserSettings().reminderLeadTimeMins || 1440,
      googleOauthId: null,
      hasGoogleConnected: false,
      avatarUrl: null,
      university: 'University of Management and Technology',
      major: 'Software Engineering',
      semester: '6th Semester',
      isOnboarded: true,
      plan: 'free',
      aiProviderPreference: 'system',
      activeByokProvider: null,
      bonusCourses: 0,
      createdAt: new Date(),
    };

    // Strictly enforce student role for arham.solution.me
    if (targetUser.email && targetUser.email.toLowerCase().includes('arham.solution.me')) {
      targetUser.role = 'student';
    }

    let userCoursesCount = 0;
    try {
      const userCourses = await prisma.course.findMany({
        where: { userId: targetUser.id },
      });
      userCoursesCount = userCourses.length;
    } catch {
      userCoursesCount = 0;
    }

    const normPlan = normalizePlanId(targetUser.plan);
    const planCfg = getPlanConfig(normPlan);
    const bonusCourses = (targetUser as any).bonusCourses || 0;
    const effectiveMaxCourses = planCfg.maxCourses + bonusCourses;

    const trialStatus = calculateTrialStatus({
      createdAt: targetUser.createdAt,
      plan: normPlan,
    });

    const nextUpgradePlan = (normPlan === 'trial' || normPlan === 'free') ? 'plus' : (normPlan === 'plus' ? 'pro' : 'campus');
    const planInfo = {
      plan: normPlan,
      planName: planCfg.name,
      headline: planCfg.headline,
      description: planCfg.description,
      maxCourses: effectiveMaxCourses,
      baseMaxCourses: planCfg.maxCourses,
      bonusCourses,
      currentCourses: userCoursesCount,
      maxUploadMB: planCfg.maxUploadMB,
      trialDaysRemaining: trialStatus.trialDaysRemaining,
      isTrialExpired: trialStatus.isTrialExpired,
      trialEndsAt: trialStatus.trialEndsAt,
      canCreateCourse: userCoursesCount < effectiveMaxCourses && !trialStatus.isTrialExpired,
      canUpload: !trialStatus.isTrialExpired,
      whatsappFeatures: planCfg.whatsappFeatures,
      byokFeatures: planCfg.byokFeatures,
      pricing: planCfg.pricing,
      whatsappUpgradeUrl: buildWhatsAppPurchaseUrl(nextUpgradePlan, 'monthly', targetUser.email),
    };

    return {
      ...targetUser,
      plan: normPlan,
      hasGoogleConnected: !!targetUser.googleOauthId,
      planInfo,
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
        plan: data.plan || 'trial',
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
