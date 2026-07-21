import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Per-user rate limiter: 30 QR scans per hour.
 * Key: user_id from the verified JWT (set by authenticateJWT middleware).
 */
export const userQrRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  keyGenerator: (req: Request) => {
    // Key by user_id from JWT — not IP, so no IPv6 concerns here
    const userId = (req as any).user?.id;
    return userId ?? 'anonymous';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many QR scan attempts. Please wait before trying again.',
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  validate: { xForwardedForHeader: false },  // trust proxy already set in index.ts
});

/**
 * Per-IP rate limiter: 100 QR scans per hour.
 * Uses default IP keying (handles IPv6 correctly).
 */
export const ipQrRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  // No custom keyGenerator — express-rate-limit v8 defaults to req.ip with IPv6 support
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this network. Please try again later.',
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  validate: { xForwardedForHeader: false },
});
