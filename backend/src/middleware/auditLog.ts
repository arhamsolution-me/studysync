import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './authGuard';

/**
 * Middleware: Logs security-relevant and data-modifying actions to audit_log table.
 * Append-only log for compliance and FYP defense demonstration.
 */
export const auditLog = (action: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Fire and forget — don't block the request
      setImmediate(async () => {
        try {
          await prisma.auditLog.create({
            data: {
              userId: req.userId || null,
              action,
              metadata: {
                method: req.method,
                path: req.originalUrl,
                userAgent: req.headers['user-agent'] || 'unknown',
              },
              ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
            },
          });
        } catch (err) {
          console.error('[AuditLog] Failed to write audit log:', err);
        }
      });
      next();
    } catch (error) {
      // Never block the request due to audit logging failure
      next();
    }
  };
};
