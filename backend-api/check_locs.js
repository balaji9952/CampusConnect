const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const locs = await prisma.locations.findMany();
  console.log(locs);
}
check().finally(() => prisma.$disconnect());
