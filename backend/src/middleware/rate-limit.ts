import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    // In test environment, bypass rate limit to avoid interfering with tests
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const clientRecord = hits.get(ip);

    if (!clientRecord || now > clientRecord.resetTime) {
      hits.set(ip, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    clientRecord.count += 1;

    if (clientRecord.count > options.max) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Rate limit exceeded. Please try again later.'
      });
    }

    next();
  };
}

export const otpRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many OTP requests. Please wait a minute.'
});

export const paymentIntentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many payment requests. Please try again shortly.'
});

export const writeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Rate limit exceeded.'
});
