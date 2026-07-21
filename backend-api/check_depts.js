const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const depts = await prisma.departments.findMany();
  console.log(depts);
}
check().finally(() => prisma.$disconnect());
