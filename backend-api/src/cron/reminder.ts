import cron from 'node-cron';
import prisma from '../utils/prisma';
import { FCMService } from '../services/fcm.service';
import { v4 as uuidv4 } from 'uuid';

export function initReminderCron() {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Starting pending ticket reminders...');
    try {
      await processPendingReminders();
    } catch (error) {
      console.error('[CRON ERROR] Reminder Job:', error);
    }
  });
}

async function processPendingReminders() {
  // Find all open tickets with an assigned user
  const tickets = await prisma.tickets.findMany({
    where: {
      status: { notIn: [2, 4] }
    },
    include: {
      ticket_assignments: {
        orderBy: { assigned_at: 'desc' },
        take: 1
      }
    }
  });

  // Group pending tickets by assignee ID
  const assigneeTicketCount: Record<string, number> = {};
  for (const t of tickets) {
    if (t.ticket_assignments.length > 0) {
      const assigneeId = t.ticket_assignments[0].assigned_to_user_id;
      if (assigneeId) {
        assigneeTicketCount[assigneeId] = (assigneeTicketCount[assigneeId] || 0) + 1;
      }
    }
  }

  let reminded = 0;
  for (const [userId, count] of Object.entries(assigneeTicketCount)) {
    if (count <= 0) continue;

    const title = 'Pending Ticket Reminder';
    const body = `You have ${count} pending ticket${count > 1 ? 's' : ''} waiting for your action.`;

    // ── 1. Persist notification to DB first ────────────────────────────────────
    try {
      await prisma.notifications.create({
        data: {
          id: uuidv4(),
          user_id: userId,
          title,
          body,
          type: 'REMINDER',
          ticket_id: null,
          privileged_only: true,
        }
      });
    } catch (dbErr) {
      console.error(`[CRON] Failed to persist reminder notification for user ${userId}:`, dbErr);
      // Continue to FCM even if DB write fails — but log it
    }

    // ── 2. Attempt FCM delivery AFTER DB record is saved ──────────────────────
    try {
      await FCMService.sendPushToUser(userId, title, body, {}, 'reminders');
      reminded++;
    } catch (fcmErr) {
      console.error(`[CRON] Failed to send reminder FCM for user ${userId}:`, fcmErr);
    }
  }

  console.log(`[CRON] Sent reminders to ${reminded}/${Object.keys(assigneeTicketCount).length} users.`);
}
