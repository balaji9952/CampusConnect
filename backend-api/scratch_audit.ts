import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log("--- 1. Complaint Categories ---");
  const categories = await prisma.complaint_categories.findMany();
  console.table(categories);

  console.log("\n--- 2. Global Assignments ---");
  const globalAssignments = await prisma.global_assignments.findMany({
    include: { users: { select: { id: true, name: true, email: true, designation: true } } }
  });
  console.dir(globalAssignments, { depth: null });

  console.log("\n--- 4/5. Recent Tickets ---");
  const recentTickets = await prisma.tickets.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    include: {
      complaint_categories: true,
      ticket_assignments: true
    }
  });
  console.dir(recentTickets, { depth: null });
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
