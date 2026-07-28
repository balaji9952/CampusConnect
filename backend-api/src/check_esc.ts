import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const esc = await prisma.escalation_assignments.findMany({ where: { department_id: 1 } });
  console.log('Escalation assignments for Dept 1:', esc);
}

main().finally(() => prisma.$disconnect());
