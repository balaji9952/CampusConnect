import { processEscalations } from '../src/services/cron.service';
import prisma from '../src/utils/prisma';
import { v4 as uuidv4 } from 'uuid';

async function test() {
  // Try to find a user and location and category
  const student = await prisma.users.findFirst({ where: { role: 0 } });
  const location = await prisma.locations.findFirst();
  const category = await prisma.complaint_categories.findFirst();

  if (!student || !location || !category) {
    console.log("Not enough data to create a test ticket.");
    return;
  }

  const ticketId = uuidv4().substring(0, 30);
  
  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

  console.log(`Creating test ticket ${ticketId} created 25 hours ago...`);
  
  await prisma.tickets.create({
    data: {
      id: ticketId,
      title: "Test SLA Breach Ticket",
      description: "Testing SLA auto escalation",
      location_id: location.id,
      location_name: location.name,
      category_id: category.id,
      category_name: category.name,
      creator_id: student.id,
      creator_name: student.name,
      creator_role: "Student",
      priority: 1,
      status: 0,
      escalation_level: 1,
      created_at: twentyFiveHoursAgo
    }
  });

  console.log("Running processEscalations()...");
  await processEscalations();

  console.log("Validating...");
  const updatedTicket = await prisma.tickets.findUnique({ where: { id: ticketId } });
  console.log("New Escalation Level:", updatedTicket?.escalation_level);

  const history = await prisma.escalation_history.findFirst({
    where: { ticket_id: ticketId },
    orderBy: { escalated_at: 'desc' }
  });
  console.log("History:", history);

  const update = await prisma.ticket_updates.findFirst({
    where: { ticket_id: ticketId },
    orderBy: { created_at: 'desc' }
  });
  console.log("Ticket Update:", update);

  const notification = await prisma.notifications.findFirst({
    where: { ticket_id: ticketId },
    orderBy: { created_at: 'desc' }
  });
  console.log("Notification:", notification);

  // cleanup
  await prisma.tickets.delete({ where: { id: ticketId } });
}

test().catch(console.error).finally(() => prisma.$disconnect());
