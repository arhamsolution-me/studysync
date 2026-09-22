import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware.
 * Catches all unhandled errors and returns clean, user-friendly messages.
 * Never exposes raw technical details to the end user.
 */
export const errorHandler = (
  err: Error & { statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[Error]', err.stack || err.message);

  const statusCode = err.statusCode || 500;

  // Human-friendly error messages (per UI/UX design guide)
  const userMessage =
    statusCode === 500
      ? 'Something went wrong on our end — we\'re looking into it. Please try again in a moment.'
      : err.message;

  res.status(statusCode).json({
    success: false,
    message: userMessage,
    ...(process.env.NODE_ENV === 'development' && {
      debug: {
        name: err.name,
        stack: err.stack,
      },
    }),
  });
};
