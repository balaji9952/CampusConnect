const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTicket() {
  const ticketId = '51f85b52-a36b-4585-a411-f5f77c050fb3'; // Assuming suffix based on common UUID
  
  // Just find by prefix
  const ticket = await prisma.tickets.findFirst({
    where: { id: { startsWith: '51f85b52' } },
    include: { ticket_assignments: { orderBy: { assigned_at: 'desc' } } }
  });
  
  console.dir(ticket, { depth: null });
  
  const aidsHod = await prisma.users.findFirst({
    where: { name: 'AIDS_HOD' }
  });
  console.log('AIDS_HOD user id:', aidsHod?.id);
}

checkTicket().catch(console.error).finally(() => prisma.$disconnect());
