const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.users.findFirst({ where: { name: 'CSE_HOD' } });
  console.log('CSE HOD department_id:', staff.department_id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
