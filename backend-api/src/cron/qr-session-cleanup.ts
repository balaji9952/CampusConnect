import cron from 'node-cron';
import prisma from '../utils/prisma';

const BATCH_SIZE = 500;

/**
 * Batch-deletes records to avoid long table locks on large datasets.
 * Runs two sweeps per hour:
 *   1. All expired sessions (expired_at < now)
 *   2. Used sessions older than 24 hours (forensic retention window)
 */
async function deleteExpiredSessions(): Promise<void> {
  const now = new Date();
  let totalDeleted = 0;

  // ── Sweep 1: Expired sessions ──────────────────────────────────────────────
  while (true) {
    const batch = await prisma.qr_verification_sessions.findMany({
      where: { expires_at: { lt: now } },
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    const { count } = await prisma.qr_verification_sessions.deleteMany({
      where: { id: { in: batch.map((r) => r.id) } },
    });
    totalDeleted += count;

    // Yield between batches to reduce DB pressure
    if (batch.length === BATCH_SIZE) await new Promise((r) => setTimeout(r, 100));
  }

  // ── Sweep 2: Used sessions older than 24 hours ─────────────────────────────
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  while (true) {
    const batch = await prisma.qr_verification_sessions.findMany({
      where: { used: true, issued_at: { lt: cutoff24h } },
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    const { count } = await prisma.qr_verification_sessions.deleteMany({
      where: { id: { in: batch.map((r) => r.id) } },
    });
    totalDeleted += count;

    if (batch.length === BATCH_SIZE) await new Promise((r) => setTimeout(r, 100));
  }

  if (totalDeleted > 0) {
    console.log(`[CRON] QR session cleanup: removed ${totalDeleted} rows`);
  }
}

/**
 * Initialises the hourly QR session cleanup cron job.
 * Runs at minute 30 of every hour (offset from escalation cron at :00).
 */
export function initQrSessionCleanupCron(): void {
  cron.schedule('30 * * * *', async () => {
    console.log('[CRON] Running QR verification session cleanup...');
    try {
      await deleteExpiredSessions();
    } catch (e) {
      console.error('[CRON ERROR] QR session cleanup failed:', e);
    }
  });
  console.log('[CRON] QR session cleanup scheduled (every hour at :30)');
}

// Export for testing
export { deleteExpiredSessions };
