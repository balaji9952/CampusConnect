const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const u = await prisma.users.findUnique({ where: { id: 'a6af545c-8c52-42c4-a1a7-4de39710fd3a' } });
  console.log(u);
}
check().finally(() => prisma.$disconnect());
