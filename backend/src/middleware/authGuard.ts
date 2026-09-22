import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Middleware: Verifies JWT access token from httpOnly cookie or Authorization header.
 * Attaches userId and userRole to the request object.
 */
export const authGuard = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    let token = req.cookies?.accessToken;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (authHeader) {
      token = authHeader.trim();
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret) as {
        userId: string;
        role: string;
      };
      req.userId = decoded.userId;
      req.userRole = decoded.role;
      return next();
    } catch (jwtErr: any) {
      res.status(401).json({
        success: false,
        message: 'Session expired or invalid token. Please log in again.',
      });
      return;
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication error. Please log in.',
    });
    return;
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
