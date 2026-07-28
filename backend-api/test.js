const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.users.count()
  .then(c => console.log('Count:', c))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
