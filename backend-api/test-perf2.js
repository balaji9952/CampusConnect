const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const userId = '093e2824-0bfc-419e-953e-cc9a025bb913';
  const role = 'Staff';
  
  console.time('fetch user');
  const userRecord = await prisma.users.findUnique({
      where: { id: userId },
      select: { department_id: true, designation: true }
  });
  console.timeEnd('fetch user');

  const { AssignmentRepository } = require('./src/repositories/AssignmentRepository');
  console.time('getVisibleTicketIds');
  const visibleTicketIds = await AssignmentRepository.getVisibleTicketIds(
      userId, 
      role, 
      userRecord.designation, 
      userRecord.department_id
  );
  console.timeEnd('getVisibleTicketIds');
  
  console.log('visibleTicketIds length:', visibleTicketIds.length);
  
  const baseWhere = { is_deleted: false, id: { in: visibleTicketIds } };
  
  console.time('prisma count');
  await prisma.tickets.count({ where: baseWhere });
  console.timeEnd('prisma count');

  console.time('prisma findMany');
  await prisma.tickets.findMany({
    where: baseWhere,
    orderBy: { created_at: 'desc' },
    include: { locations: true, complaint_categories: true, ticket_updates: true },
    skip: 0,
    take: 50,
  });
  console.timeEnd('prisma findMany');
}

test().catch(console.error).finally(() => prisma.$disconnect());
