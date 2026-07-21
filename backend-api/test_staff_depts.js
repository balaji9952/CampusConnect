const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.users.findMany({ where: { name: { in: ['MECH_HOD', 'ECE_HOD', 'CSE_HOD'] } } });
  console.log(staff.map(s => ({ name: s.name, dept_id: s.department_id })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
