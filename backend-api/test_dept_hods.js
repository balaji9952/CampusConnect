const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.departments.findMany();
  for (const d of depts) {
    console.log(`Dept: ${d.name}, HOD ID: ${d.hod_user_id}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
