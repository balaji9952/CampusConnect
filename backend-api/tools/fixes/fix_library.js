const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.locations.update({
    where: { name: 'Library' },
    data: {
      routing_type: 'GLOBAL_ROUTED',
      routing_key: 'LIBRARY_HEAD'
    }
  });
  console.log('✅ Updated Library routing to GLOBAL_ROUTED with key LIBRARY_HEAD');
}

main().finally(() => prisma.$disconnect());
