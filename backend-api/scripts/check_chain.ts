import prisma from '../src/utils/prisma';

async function checkChain() {
  console.log('--- STARTING CHAIN CHECK ---');
  const student = await prisma.users.findFirst({ where: { role: 0 }, include: { departments_users_department_idTodepartments: true } });
  if (!student) {
    console.log('No student found');
    return;
  }
  
  console.log('1. Student found:', student.id, 'Name:', student.name);
  console.log('   department_id:', student.department_id);
  
  if (!student.department_id) {
    console.log('CHAIN BROKEN: Student has no department_id');
    return;
  }
  
  const dept = await prisma.departments.findUnique({
    where: { id: student.department_id }
  });
  
  console.log('2. Department found:', dept?.id, 'Name:', dept?.name);
  console.log('   hod_user_id:', dept?.hod_user_id);
  
  if (!dept?.hod_user_id) {
    console.log('CHAIN BROKEN: Department has no hod_user_id');
    return;
  }
  
  const hod = await prisma.users.findUnique({
    where: { id: dept.hod_user_id }
  });
  
  console.log('3. HOD found:', hod?.id, 'Name:', hod?.name);
  if (!hod) {
    console.log('CHAIN BROKEN: HOD user not found in users table');
    return;
  }
  
  console.log('CHAIN COMPLETE!');
}

checkChain()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
