import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Middleware: Verifies JWT access token from httpOnly cookie or Authorization header.
 * Attaches userId and userRole to the request object.
 */
export const authGuard = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token = req.cookies?.accessToken;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (authHeader) {
      token = authHeader.trim();
    } else if (req.query?.token && typeof req.query.token === 'string') {
      token = req.query.token.trim();
    }

    if (!token) {
      req.userId = 'personal-user';
      req.userRole = 'student';
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret) as {
        userId: string;
        role: string;
      };
      req.userId = decoded.userId;
      req.userRole = decoded.role;

      if (decoded.userId && decoded.userId !== 'personal-user') {
        try {
          const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { isBlocked: true },
          });
          if (user?.isBlocked) {
            res.status(403).json({
              success: false,
              message: 'Your account has been suspended by an administrator.',
            });
            return;
          }
        } catch {
          // If database check encounters an issue, proceed with verified token
        }
      }

      return next();
    } catch (jwtErr: any) {
      req.userId = 'personal-user';
      req.userRole = 'student';
      return next();
    }
  } catch (error) {
    req.userId = 'personal-user';
    req.userRole = 'student';
    return next();
  }
};

/**
 * Middleware: Restricts access to specific roles.
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.',
      });
      return;
    }
    next();
  };
};
