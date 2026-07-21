import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: any;
}
import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import prisma from '../utils/prisma';

// Cache the session timeout to avoid hitting DB on every single request
let cachedTimeoutMinutes: number = 30;
let cacheLastFetched: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // Refresh timeout setting every 5 minutes

async function getSessionTimeoutMinutes(): Promise<number> {
  const now = Date.now();
  if (now - cacheLastFetched < CACHE_TTL_MS) return cachedTimeoutMinutes;

  try {
    const record = await prisma.system_settings.findUnique({ where: { key: 'security_settings' } });
    if (record) {
      const parsed = JSON.parse(record.value);
      const s = parsed.settings || parsed;
      if (typeof s.sessionTimeout === 'number' && s.sessionTimeout > 0) {
        cachedTimeoutMinutes = s.sessionTimeout;
      }
    }
  } catch (e) {
    // Keep using cached/default value on error
  }

  cacheLastFetched = now;
  return cachedTimeoutMinutes;
}

const sessionCache = new Map<string, { session: any, expiry: number }>();

export const authenticateJWT: RequestHandler = async (
  req,
  res,
  next
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ message: "No Authorization Header" });
    return;
  }

  const token = authHeader.split(' ')[1];

  const secret = process.env.JWT_SECRET!;
  const issuer = process.env.JWT_ISSUER || 'CampusConnect';
  const audience = process.env.JWT_AUDIENCE || 'CampusConnectApp';

  try {
    const user = jwt.verify(token, secret, { issuer, audience }) as any;

    if (user.sessionId) {
      let session: any = null;
      const cached = sessionCache.get(user.sessionId);
      
      if (cached && cached.expiry > Date.now()) {
        session = cached.session;
      } else {
        session = await prisma.user_sessions.findUnique({ where: { id: user.sessionId } });
        if (session) {
          sessionCache.set(user.sessionId, { session, expiry: Date.now() + 60000 }); // cache for 60s
        }
      }

      if (!session) {
        res.status(401).json({ message: "Session not found" });
        return;
      }
      if (session.is_revoked) {
        res.status(401).json({ message: "Session revoked" });
        return;
      }

      // ── Session Timeout Check ──────────────────────────────────────────────
      const timeoutMinutes = await getSessionTimeoutMinutes();
      const now = new Date();
      const idleMs = now.getTime() - session.last_activity.getTime();
      const timeoutMs = timeoutMinutes * 60 * 1000;

      if (idleMs > timeoutMs) {
        // Auto-revoke the session
        await prisma.user_sessions.update({
          where: { id: session.id },
          data: { is_revoked: true }
        });
        res.status(401).json({ 
          message: `Session expired due to inactivity (${timeoutMinutes} min timeout). Please log in again.`,
          code: 'SESSION_TIMEOUT'
        });
        return;
      }

      // Update last_activity if it's been more than 5 minutes since last update
      if (idleMs > 5 * 60 * 1000) {
        await prisma.user_sessions.update({
          where: { id: session.id },
          data: { last_activity: now }
        });
      }
    }

    (req as any).user = user;
    next();
  } catch (err: any) {
    res.status(403).json({
      message: "Forbidden",
      error: err.message
    });
  }
};