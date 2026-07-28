const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const locs = await prisma.locations.findMany();
  console.log("Locations:", JSON.stringify(locs, null, 2));
  const routing = await prisma.routing_groups.findMany();
  console.log("Routing:", JSON.stringify(routing, null, 2));
}
run().finally(() => prisma.$disconnect());
