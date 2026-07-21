import cron from 'node-cron';
import prisma from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';
import { VisibilityService } from './visibility.service';
import { FCMService } from './fcm.service';

export const startCronJobs = () => {
  cron.schedule('0 * * * *', async () => {
    await processEscalations();
  });
};

export const processEscalations = async () => {
  console.log('[CRON] Started');

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Level 1 -> Level 2
  const level1Tickets = await prisma.tickets.findMany({
    where: {
      is_deleted: false,
      status: { not: 3 },
      escalation_level: 1,
      created_at: { lte: twentyFourHoursAgo }
    }
  });

  console.log('[CRON] Level1 Found:', level1Tickets.length);

  for (const ticket of level1Tickets) {
    await escalateTicket(ticket.id, 1, 2);
  }

  // Level 2 -> Level 3
  const level2Tickets = await prisma.tickets.findMany({
    where: {
      is_deleted: false,
      status: { not: 3 },
      escalation_level: 2,
      created_at: { lte: fortyEightHoursAgo }
    }
  });

  console.log('[CRON] Level2 Found:', level2Tickets.length);

  for (const ticket of level2Tickets) {
    await escalateTicket(ticket.id, 2, 3);
  }

  console.log('[CRON] Completed');
};

async function escalateTicket(ticketId: string, fromLevel: number, toLevel: number) {
  try {
    const updatedTicket = await prisma.$transaction(async (tx) => {
      const t = await tx.tickets.update({
        where: { id: ticketId },
        data: { escalation_level: toLevel }
      });

      await tx.escalation_history.create({
        data: {
          ticket_id: ticketId,
          from_level: fromLevel,
          to_level: toLevel,
          reason: 'Automatically escalated due to SLA breach',
          user_id: null,
          escalated_at: new Date()
        }
      });

      await tx.ticket_updates.create({
        data: {
          ticket_id: ticketId,
          message: 'Ticket automatically escalated',
          update_type: 'ESCALATED',
          updated_by: 'System'
        }
      });

      await tx.notifications.create({
        data: {
          id: uuidv4(),
          title: 'Ticket Escalated',
          body: `Ticket #${t.ticket_number} escalated from Level ${fromLevel} to Level ${toLevel}`,
          type: 'TICKET_ESCALATED',
          ticket_id: ticketId,
          privileged_only: true
        }
      });

      return t;
    });

    // ── Fire FCM pushes AFTER transaction commit (DB-first policy) ───────────────
    const authorizedUsers = await VisibilityService.getUsersWithTicketVisibility(ticketId);
    for (const userId of authorizedUsers) {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { role: true, designation: true }
      });
      if (!user) continue;

      if (VisibilityService.isAdmin(user.role, user.designation) || VisibilityService.isStaff(user.role)) {
        await FCMService.sendPushToUser(
          userId,
          'Ticket Escalated',
          `Ticket #${updatedTicket.ticket_number} has been escalated from Level ${fromLevel} to Level ${toLevel}`,
          { ticketId: ticketId, type: 'TICKET_ESCALATED' },
          'escalations'
        ).catch(e => console.error(`[CRON] FCM error for user ${userId}:`, e));
      }
    }
  } catch (error) {
    console.error(`[CRON] Error escalating ticket ${ticketId}:`, error);
  }
}
