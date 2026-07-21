const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.users.findFirst({ where: { name: 'CSE_HOD' } });
  console.log('CSE HOD ID:', staff.id);

  const assignedTickets = await prisma.ticket_assignments.findMany({
    where: { assigned_to_user_id: staff.id }
  });
  console.log('Ticket assignments for CSE HOD:', assignedTickets);

  for (const t of assignedTickets) {
    const ticket = await prisma.tickets.findUnique({ where: { id: t.ticket_id } });
    console.log(`Ticket ${t.ticket_id}: status=${ticket.status}, is_deleted=${ticket.is_deleted}, assigned_to_name=${ticket.assigned_to_name}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
