const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.tickets.findFirst({
  where: {id: {startsWith: '51f85'}},
  include: {ticket_updates: true}
}).then(res => console.dir(res, {depth: null})).finally(() => prisma.$disconnect());
