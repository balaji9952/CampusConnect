import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const t = await prisma.tickets.findFirst({
    include: { locations: true, complaint_categories: true, ticket_updates: true }
  });
  console.log(t);
}

main().finally(() => prisma.$disconnect());
