const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const t = await prisma.ticket_assignments.findMany({ where: { ticket_id: 'ae59e598-c7aa-40ca-941e-cd033b' } });
  console.log(t);
}

check().finally(() => prisma.$disconnect());
