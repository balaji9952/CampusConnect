const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tickets = await prisma.tickets.findMany({
    where: { status: { in: [0, 1] }, is_deleted: false },
    take: 5,
    include: {
      locations: {
        include: { departments: true }
      }
    }
  });
  console.log("TICKETS:", JSON.stringify(tickets, null, 2));
}

run();
