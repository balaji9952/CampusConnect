const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const assignments = await prisma.global_assignments.findMany({
    include: {
      users: { select: { name: true, email: true, designation: true } }
    }
  });
  console.log(JSON.stringify(assignments, null, 2));
}

check().finally(() => prisma.$disconnect());
