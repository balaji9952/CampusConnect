const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { AssignmentRepository } = require('./repositories/AssignmentRepository');

async function main() {
  const staff = await prisma.users.findFirst({
    where: { name: 'Saravanan V' }
  });
  console.log('Staff:', staff?.id);

  if (staff) {
    const ids = await AssignmentRepository.getTicketsAssignedToUser(staff.id);
    console.log('Assigned ticket IDs:', ids);

    if (ids.length > 0) {
      const tickets = await prisma.tickets.findMany({
        where: { id: { in: ids }, is_deleted: false, status: { in: [0, 1] } }
      });
      console.log('Active tickets:', tickets.map(t => t.id));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
