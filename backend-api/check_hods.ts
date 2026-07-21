import prisma from './src/utils/prisma';

async function fixDB() {
  const hods = await prisma.users.findMany({ where: { designation: 'HOD' } });
  console.log('Available HODs:', hods.map(h => ({ id: h.id, name: h.name, dept: h.department_id })));
  
  const depts = await prisma.departments.findMany();
  console.log('Departments:', depts.map(d => ({ id: d.id, name: d.name, hod: d.hod_user_id })));
}

fixDB().finally(() => prisma.$disconnect());
