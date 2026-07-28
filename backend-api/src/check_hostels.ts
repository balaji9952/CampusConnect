import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkHostels() {
  const locs = await prisma.locations.findMany();
  console.log('All Locations:');
  console.log(locs);
}

checkHostels()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
