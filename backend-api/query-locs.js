const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.locations.findMany().then(locs => {
  console.log(locs.map(l => ({ name: l.name, type: l.routing_type })));
}).finally(() => prisma.$disconnect());
