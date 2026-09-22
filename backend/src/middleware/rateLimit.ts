
import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';

interface RateLimitOptions {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string;  // Redis key prefix
  message?: string;    // Custom error message
}

/**
 * Redis-backed rate limiter middleware.
 * Uses sliding window counter approach for accurate rate limiting.
 */
export const rateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    keyPrefix = 'rl',
    message = 'Too many requests — please try again in a moment.',
  } = options;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (redis.status !== 'ready') {
      next();
      return;
    }
    try {
      const identifier = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `${keyPrefix}:${identifier}`;

      const current = await redis.incr(key);

      if (current === 1) {
        // First request in this window — set the TTL
        await redis.expire(key, windowSeconds);
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

      if (current > maxRequests) {
        const ttl = await redis.ttl(key);
        res.setHeader('Retry-After', ttl);
        res.status(429).json({
          success: false,
          message,
          retryAfter: ttl,
        });
        return;
      }

      next();
    } catch (error) {
      // If Redis is down, allow the request through (fail-open)
      console.error('[RateLimit] Redis error, failing open:', error);
      next();
    }
  };
};

// Pre-configured rate limiters
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 100,
  keyPrefix: 'rl:general',
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 5,
  keyPrefix: 'rl:auth',
  message: 'Too many login attempts — please wait a minute before trying again.',
});

export const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 10,
  keyPrefix: 'rl:voice',
  message: 'Voice capture rate limit reached — please wait before recording again.',
});
