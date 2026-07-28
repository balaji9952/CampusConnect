import cron from 'node-cron';
import prisma from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';
import { FCMService } from '../services/fcm.service';
import { DesignationsService } from '../services/designations.service';

export function initEscalationCron() {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Starting SLA-driven automatic ticket escalation check...');
    try {
      await processLevel1ToLevel2();
      await processLevel2ToLevel3();
    } catch (error) {
      console.error('[CRON ERROR]', error);
    }
  });
}

export async function processLevel1ToLevel2() {
  let globalSlaL1 = 24;
  let autoEscalate = true;

  try {
    const setting = await prisma.system_settings.findUnique({ where: { key: 'escalation_settings' } });
    if (setting) {
      const parsed = JSON.parse(setting.value);
      const data = parsed.settings ? parsed.settings : parsed;
      if (data.sla?.l1) globalSlaL1 = data.sla.l1;
      autoEscalate = data.autoEscalate === true;
    }
  } catch (e) {
    console.error('Error loading escalation_settings', e);
  }

  if (!autoEscalate) {
    console.log('[CRON] Auto-escalation is globally disabled via settings.');
    return;
  }

  const tickets = await prisma.tickets.findMany({
    where: {
      escalation_level: 1,
      status: { notIn: [2, 4] },
      ticket_type: { not: 'PARENT_FEEDBACK' },
    },
    include: {
      complaint_categories: { select: { sla_response_hours: true } },
      ticket_assignments: {
        orderBy: { assigned_at: 'desc' },
        take: 1
      },
      locations: {
        select: {
          department_id: true,
          routing_group_id: true,
          location_categories: {
            select: {
              routing_type: true
            }
          }
        }
      }
    }
  });

  const now = Date.now();
  const eligibleTickets = tickets.filter(t => {
    const slaHours = t.complaint_categories?.sla_response_hours || globalSlaL1;
    const lastAssignment = t.ticket_assignments[0];
    const assignedAt = lastAssignment ? lastAssignment.assigned_at.getTime() : t.created_at.getTime();
    return now > assignedAt + (slaHours * 60 * 60 * 1000);
  });

  if (eligibleTickets.length === 0) return;

  for (const ticket of eligibleTickets) {
    const slaHours = ticket.complaint_categories?.sla_response_hours || globalSlaL1;
    const { name, role, id } = await resolveEscalationTarget(ticket, 2);
    await escalateTicket(
      ticket, 2, name, role, id,
      `SLA Breached: Unresolved after ${slaHours} hours response threshold. Auto-escalated to Level 2 (${role}).`
    );
  }
}

export async function processLevel2ToLevel3() {
  let globalSlaL2 = 48;
  let autoEscalate = false; // Default to false to match UI default

  try {
    const setting = await prisma.system_settings.findUnique({ where: { key: 'escalation_settings' } });
    if (setting) {
      const parsed = JSON.parse(setting.value);
      const data = parsed.settings ? parsed.settings : parsed;
      if (data.sla?.l2) globalSlaL2 = data.sla.l2;
      autoEscalate = data.autoEscalate === true;
    }
  } catch (e) {
    console.error('Error loading escalation_settings', e);
  }

  if (!autoEscalate) return;

  const tickets = await prisma.tickets.findMany({
    where: {
      escalation_level: 2,
      status: { notIn: [2, 4] },
      ticket_type: { not: 'PARENT_FEEDBACK' },
    },
    include: {
      complaint_categories: { select: { sla_escalation_hours: true } },
      ticket_assignments: {
        orderBy: { assigned_at: 'desc' },
        take: 1
      },
      locations: {
        select: {
          department_id: true,
          routing_group_id: true,
          location_categories: {
            select: {
              routing_type: true
            }
          }
        }
      }
    }
  });

  const now = Date.now();
  const eligibleTickets = tickets.filter(t => {
    const slaHours = t.complaint_categories?.sla_escalation_hours || globalSlaL2;
    const lastAssignment = t.ticket_assignments[0];
    const assignedAt = lastAssignment ? lastAssignment.assigned_at.getTime() : t.created_at.getTime();
    return now > assignedAt + (slaHours * 60 * 60 * 1000);
  });

  if (eligibleTickets.length === 0) return;

  for (const ticket of eligibleTickets) {
    const slaHours = ticket.complaint_categories?.sla_escalation_hours || globalSlaL2;
    const { name, role, id } = await resolveEscalationTarget(ticket, 3);
    await escalateTicket(
      ticket, 3, name, role, id,
      `SLA Breached: Unresolved after ${slaHours} hours escalation threshold. Auto-escalated to Level 3 (${role}).`
    );
  }
}

async function escalateTicket(ticket: any, newLevel: number, newAssigneeName: string, newAssigneeRole: string, newAssigneeId: string | null, reason: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Update ticket
    await tx.tickets.update({
      where: { id: ticket.id },
      data: {
        escalation_level: newLevel,
        assigned_to_name: newAssigneeName,
        assigned_role: newAssigneeRole,
        updated_at: now
      }
    });

    // 2. Insert ticket_assignments (Immutable History)
    await tx.ticket_assignments.create({
      data: {
        ticket_id: ticket.id,
        assigned_to_user_id: newAssigneeId,
        assigned_by: null, // System
        assignment_reason: reason,
        escalation_level: newLevel,
        assigned_at: now
      }
    });

    // 3. Insert escalation_history
    await tx.escalation_history.create({
      data: {
        ticket_id: ticket.id,
        from_level: ticket.escalation_level,
        to_level: newLevel,
        from_assignee: ticket.assigned_to_name,
        to_assignee: newAssigneeName,
        reason: reason,
        escalated_by: 'System',
        user_id: null, // System
        escalated_at: now
      }
    });

    // 4. Insert ticket_updates
    await tx.ticket_updates.create({
      data: {
        ticket_id: ticket.id,
        message: reason,
        update_type: 'escalation',
        updated_by: 'System',
        created_at: now
      }
    });

    // 5. Notifications (Student + New Assignee)
    const notificationsToCreate = [];

    // For Student
    notificationsToCreate.push({
      id: uuidv4(),
      user_id: ticket.creator_id,
      title: 'Ticket Escalated',
      body: `Your ticket ${ticket.id} has been automatically escalated to ${newAssigneeRole} due to SLA breach.`,
      type: 'ESCALATION',
      ticket_id: ticket.id,
      privileged_only: false,
      created_at: now
    });

    // For New Assignee
    if (newAssigneeId) {
      notificationsToCreate.push({
        id: uuidv4(),
        user_id: newAssigneeId,
        title: 'New Escalated Ticket Assigned',
        body: `Ticket ${ticket.id} has been escalated to you because it breached SLA thresholds.`,
        type: 'ESCALATION_ASSIGNED',
        ticket_id: ticket.id,
        privileged_only: true,
        created_at: now
      });
    }

    await tx.notifications.createMany({ data: notificationsToCreate });
  });

  // FCM pushes outside transaction
  await FCMService.sendPushToUser(
    ticket.creator_id,
    'Ticket Escalated',
    `Your ticket ${ticket.id} has been automatically escalated to ${newAssigneeRole}.`,
    { ticketId: ticket.id },
    'escalations'
  );

  if (newAssigneeId) {
    await FCMService.sendPushToUser(
      newAssigneeId,
      'Escalated Ticket Assigned',
      `Ticket ${ticket.id} has been escalated to you due to an SLA breach.`,
      { ticketId: ticket.id },
      'escalations'
    );
  }

  console.log(`[CRON] Ticket ${ticket.id} escalated to Level ${newLevel}`);
}

/**
 * Resolves the escalation target for a ticket using the routing chain:
 *
 * 1. GLOBAL_ROUTED tickets → look up global_assignments
 *    WHERE (routing_group_id, escalation_level = targetLevel)
 *
 * 2. DEPARTMENT_ROUTED tickets → look up escalation_assignments
 *    WHERE (department_id, escalation_level = targetLevel)
 *
 * 3. Fallback: any active user with can_escalate=true for that level
 * 4. Ultimate fallback: first active user in the system
 *
 * Returns { id, name, role } — id may be null if no target found.
 */
async function resolveEscalationTarget(
  ticket: any,
  targetLevel: 2 | 3
): Promise<{ id: string | null; name: string; role: string }> {
  const routingType = ticket.locations?.location_categories?.routing_type;
  const routingGroupId = ticket.locations?.routing_group_id;
  const locationDeptId = ticket.locations?.department_id;

  // ── 1. Global routing: check global_assignments ────────────────────────────
  if (routingType === 'GLOBAL_ROUTED' && routingGroupId) {
    const ga = await prisma.global_assignments.findFirst({
      where: { routing_group_id: routingGroupId, escalation_level: targetLevel, is_active: true },
      include: { users: { select: { id: true, name: true, designation: true } } }
    });
    if (ga?.users) {
      console.log(`[ESCALATION] Ticket ${ticket.id}: global assignment found for routing group ${routingGroupId}@L${targetLevel} → ${ga.users.name}`);
      return { id: ga.users.id, name: ga.users.name, role: ga.users.designation || `Level ${targetLevel}` };
    }
  }

  // ── 2. Department routing: check escalation_assignments ────────────────────
  if (routingType === 'DEPARTMENT_ROUTED' && locationDeptId) {
    const ea = await prisma.escalation_assignments.findFirst({
      where: { department_id: locationDeptId, escalation_level: targetLevel, is_active: true },
      include: { users: { select: { id: true, name: true, designation: true } } }
    });
    if (ea?.users) {
      console.log(`[ESCALATION] Ticket ${ticket.id}: dept escalation found for dept=${locationDeptId}@L${targetLevel} → ${ea.users.name}`);
      return { id: ea.users.id, name: ea.users.name, role: ea.users.designation || `Level ${targetLevel}` };
    }
  }

  // ── 3. Fallback: any user with can_escalate designation ───────────────────
  const escalationTarget = await DesignationsService.getEscalationTargets(targetLevel);
  const targetNames = escalationTarget.map(d => d.name);
  if (targetNames.length > 0) {
    const user = await prisma.users.findFirst({
      where: { designation: { in: targetNames }, is_active: true },
      select: { id: true, name: true, designation: true }
    });
    if (user) {
      console.log(`[ESCALATION] Ticket ${ticket.id}: fallback escalation L${targetLevel} → ${user.name}`);
      return { id: user.id, name: user.name, role: user.designation || `Level ${targetLevel}` };
    }
  }

  // ── 4. Ultimate fallback: any active user ──────────────────────────────────
  const fallback = await prisma.users.findFirst({
    where: { is_active: true },
    select: { id: true, name: true },
    orderBy: { created_at: 'asc' }
  });

  const roleLabel = `Level ${targetLevel}`;
  console.warn(`[ESCALATION] Ticket ${ticket.id}: no L${targetLevel} target configured. Ultimate fallback → ${fallback?.name ?? 'Unassigned'}`);
  return { id: fallback?.id ?? null, name: fallback?.name || 'Unassigned', role: roleLabel };
}
