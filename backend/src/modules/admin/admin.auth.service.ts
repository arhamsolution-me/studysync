import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { config } from '../../config';
import { hashPassword, verifyPassword } from '../../utils/hasher';

export interface AdminLoginInput {
  identifier: string; // username or email
  password: string;
  securityPassphrase?: string;
}

class AdminAuthService {
  /**
   * Authenticate admin against public.admin_accounts table.
   * Signs a completely isolated Admin JWT using dedicated ADMIN_JWT_SECRET.
   */
  async login({ identifier, password, securityPassphrase }: AdminLoginInput) {
    const cleanId = (identifier || '').trim();
    if (!cleanId || !password) {
      throw Object.assign(new Error('Admin username/email and password are required.'), {
        statusCode: 400,
      });
    }

    // Find admin account by username or email
    let account = await prisma.adminAccount.findFirst({
      where: {
        OR: [
          { username: cleanId },
          { email: cleanId.toLowerCase() },
        ],
      },
    });

    // Fallback search if OR query syntax varies
    if (!account) {
      account = await prisma.adminAccount.findUnique({
        where: { username: cleanId },
      });
    }
    if (!account) {
      account = await prisma.adminAccount.findUnique({
        where: { email: cleanId.toLowerCase() },
      });
    }

    if (!account) {
      throw Object.assign(new Error('Invalid admin credentials.'), {
        statusCode: 401,
      });
    }

    if (!account.isActive) {
      throw Object.assign(new Error('This administrator account has been disabled.'), {
        statusCode: 403,
      });
    }

    // Verify Password
    const isMatch = await verifyPassword(account.passwordHash, password);
    if (!isMatch) {
      throw Object.assign(new Error('Invalid admin credentials.'), {
        statusCode: 401,
      });
    }

    // Verify Security Passphrase if required on account
    if (account.securityPassphrase && account.securityPassphrase.trim() !== '') {
      if (!securityPassphrase || securityPassphrase.trim() !== account.securityPassphrase.trim()) {
        throw Object.assign(new Error('Invalid admin security passphrase.'), {
          statusCode: 401,
        });
      }
    }

    // Sign Dedicated Admin JWT
    const adminToken = jwt.sign(
      {
        adminId: account.id,
        username: account.username,
        email: account.email,
        role: account.role || 'superadmin',
        type: 'admin_session',
      },
      config.adminJwt.secret,
      { expiresIn: config.adminJwt.expiresIn } as jwt.SignOptions
    );

    // Update last login
    try {
      await prisma.adminAccount.update({
        where: { id: account.id },
        data: { lastLogin: new Date() },
      });
    } catch (err) {
      console.warn('[AdminAuth] Could not update lastLogin timestamp:', err);
    }

    return {
      adminToken,
      admin: {
        id: account.id,
        username: account.username,
        email: account.email,
        role: account.role || 'superadmin',
        lastLogin: account.lastLogin,
      },
    };
  }

  /**
   * Retrieve active admin profile
   */
  async getProfile(adminId: string) {
    const account = await prisma.adminAccount.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!account || !account.isActive) {
      throw Object.assign(new Error('Admin session invalid or expired.'), {
        statusCode: 401,
      });
    }

    return account;
  }

  /**
   * Update admin password safely
   */
  async changePassword(adminId: string, currentPass: string, newPass: string) {
    const account = await prisma.adminAccount.findUnique({
      where: { id: adminId },
    });

    if (!account) {
      throw Object.assign(new Error('Admin account not found.'), { statusCode: 404 });
    }

    const isMatch = await verifyPassword(account.passwordHash, currentPass);
    if (!isMatch) {
      throw Object.assign(new Error('Current password does not match.'), { statusCode: 400 });
    }

    if (!newPass || newPass.length < 8) {
      throw Object.assign(new Error('New password must be at least 8 characters long.'), { statusCode: 400 });
    }

    const newHash = await hashPassword(newPass);
    await prisma.adminAccount.update({
      where: { id: adminId },
      data: { passwordHash: newHash },
    });

    return { success: true, message: 'Admin password successfully updated.' };
  }
}

export const adminAuthService = new AdminAuthService();
