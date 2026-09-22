import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AdminAuthRequest extends Request {
  adminId?: string;
  adminUsername?: string;
  adminRole?: string;
}

/**
 * Dedicated Admin Authentication Guard
 * Cryptographically verifies tokens signed ONLY with ADMIN_JWT_SECRET.
 * Automatically rejects standard student JWTs or unauthorized callers.
 */
export const adminAuthGuard = (req: AdminAuthRequest, res: Response, next: NextFunction): void => {
  try {
    const adminHeader = req.headers['x-admin-token'] as string | undefined;
    const authHeader = req.headers.authorization;
    let token = adminHeader;

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (!token && authHeader) {
      token = authHeader.trim();
    } else if (!token && req.cookies?.adminAccessToken) {
      token = req.cookies.adminAccessToken;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Administrator authorization required. Access denied.',
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, config.adminJwt.secret) as {
        adminId: string;
        username: string;
        role: string;
        type?: string;
      };

      if (!decoded.adminId) {
        res.status(401).json({
          success: false,
          message: 'Malformed administrator token payload.',
        });
        return;
      }

      req.adminId = decoded.adminId;
      req.adminUsername = decoded.username;
      req.adminRole = decoded.role || 'superadmin';
      return next();
    } catch (jwtErr: any) {
      res.status(401).json({
        success: false,
        message: 'Admin session expired or invalid. Please log in at /admin/login.',
      });
      return;
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Admin authentication failure.',
    });
    return;
  }
};
