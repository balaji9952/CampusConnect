const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.zywvcurdksjgvlgeehnb:INDIA_DATABASE%403908@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
    }
  }
});
async function test() {
  try {
    const res = await prisma.$queryRaw`SELECT 1`;
    console.log('Connected to Session Pooler!', res);
  } catch (e) {
    console.error(e);
  }
  await prisma.$disconnect();
}
test();
