const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lib = await prisma.locations.findUnique({ where: { name: 'Library' } });
  console.log('Library routing_type:', lib.routing_type, 'routing_key:', lib.routing_key);
  
  const student = await prisma.users.findUnique({ where: { email: 'balaji9952@mountzion.ac.in' }});
  console.log('Student dept ID:', student?.department_id);
  
  const hod = await prisma.users.findFirst({ where: { department_id: student?.department_id, designation: 'HOD' }});
  console.log('Student Dept HOD:', hod?.name, 'ID:', hod?.id);

  // also check if "aids hod" and "ece hod" were assigned globally to 'library'?
  const global = await prisma.global_assignments.findMany();
  console.log('Global assignments:', global);
}

main().finally(() => prisma.$disconnect());
