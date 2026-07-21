const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const c1 = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM users WHERE name IS NULL');
  const c2 = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM users WHERE email IS NULL');
  const c3 = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM users WHERE password_hash IS NULL');
  const c4 = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM users WHERE role IS NULL');
  const c5 = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM users WHERE is_active IS NULL');
  console.log(c1, c2, c3, c4, c5);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
