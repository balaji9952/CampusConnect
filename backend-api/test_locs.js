const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const locs = await prisma.locations.findMany({
    select: { name: true, routing_type: true, routing_key: true, department_id: true }
  });
  console.log(locs);
}
run().finally(() => prisma.$disconnect());
