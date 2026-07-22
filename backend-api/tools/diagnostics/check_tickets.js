const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const t = await prisma.tickets.findFirst({ where: { title: 'bad plumbing' }, include: { users: true } });
  console.log(t);
}
check().finally(() => prisma.$disconnect());
