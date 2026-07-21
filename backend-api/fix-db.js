const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const result = await prisma.$executeRawUnsafe('UPDATE users SET phone = \'\' WHERE phone IS NULL');
  console.log(`Updated ${result} users with NULL phone numbers`);
}

fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
