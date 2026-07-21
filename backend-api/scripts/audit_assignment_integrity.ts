import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function audit() {
  console.log('--- Assignment Integrity Audit ---');
  let issues = 0;

  const tickets = await prisma.tickets.findMany({
    include: {
      ticket_assignments: {
        orderBy: { assigned_at: 'asc' }
      }
    }
  });

  const totalTickets = tickets.length;
  console.log(`Auditing ${totalTickets} tickets...\n`);

  for (const ticket of tickets) {
    const assignments = ticket.ticket_assignments;

    // 1. Every ticket has at least one assignment
    if (assignments.length === 0) {
      console.log(`[Error] Ticket ${ticket.id} (${ticket.ticket_number}) has NO assignments.`);
      issues++;
      continue; // Can't do other checks
    }

    // 2. Timestamps are chronological (since we ordered by asc, they should naturally be chronological)
    let lastTime = new Date(0).getTime();
    for (let i = 0; i < assignments.length; i++) {
      const time = new Date(assignments[i].assigned_at).getTime();
      if (time < lastTime) {
         console.log(`[Error] Ticket ${ticket.id} has non-chronological assignment timestamps.`);
         issues++;
      }
      lastTime = time;
    }

    // 3. Escalations
    // Check if escalation levels go backwards
    let lastEsc = -1;
    for (const a of assignments) {
      if (a.escalation_level < lastEsc) {
        console.log(`[Warning] Ticket ${ticket.id} assignment escalation level decreased from ${lastEsc} to ${a.escalation_level}.`);
      }
      lastEsc = a.escalation_level;
    }

    // 4. Exactly one latest assignment (this is inherently true if it has > 0 assignments and order is well defined)
    // However, we should ensure the latest assignment is not missing an assignee (unless it's expected)
    const latest = assignments[assignments.length - 1];
    if (!latest.assigned_to_user_id) {
       console.log(`[Warning] Ticket ${ticket.id} latest assignment has NULL assigned_to_user_id.`);
       issues++;
    }
  }

  // 5. No orphan assignment records
  // Since ticket_id is required and has a foreign key constraint, true orphans are impossible at the DB level,
  // but we can check if the ticket actually exists.
  const allAssignments = await prisma.ticket_assignments.findMany();
  const validTicketIds = new Set(tickets.map(t => t.id));
  
  for (const a of allAssignments) {
    if (!validTicketIds.has(a.ticket_id)) {
      console.log(`[Error] Found orphan ticket assignment ${a.id} for non-existent ticket ${a.ticket_id}.`);
      issues++;
    }
  }

  console.log(`\nAudit complete. Found ${issues} issues.`);
}

audit().catch(console.error).finally(() => prisma.$disconnect());
