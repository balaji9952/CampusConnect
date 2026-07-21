const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.departments.findMany();
  for (const dept of depts) {
    if (dept.hod_user_id) {
      await prisma.users.updateMany({
        where: { id: dept.hod_user_id, department_id: null },
        data: { department_id: dept.id }
      });
      console.log(`Synced department_id for HOD of ${dept.name}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
