import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.departments.findMany();
  const validDeptIds = depts.map(d => d.id);

  const locs = await prisma.locations.findMany();
  const orphanedLocs = locs.filter(l => l.department_id !== null && !validDeptIds.includes(l.department_id));
  console.log('Orphaned Locations:', orphanedLocs);

  const users = await prisma.users.findMany();
  const orphanedUsers = users.filter(u => u.department_id !== null && !validDeptIds.includes(u.department_id));
  const groupedOrphanedUsers = orphanedUsers.reduce((acc: any, curr: any) => {
    acc[curr.department_id] = (acc[curr.department_id] || 0) + 1;
    return acc;
  }, {});
  console.log('Orphaned Users by Dept ID:', groupedOrphanedUsers);

  const esc = await prisma.escalation_assignments.findMany();
  const orphanedEsc = esc.filter(e => e.department_id !== null && !validDeptIds.includes(e.department_id));
  console.log('Orphaned Escalations by Dept ID:', orphanedEsc.reduce((acc: any, curr: any) => {
    acc[curr.department_id] = (acc[curr.department_id] || 0) + 1;
    return acc;
  }, {}));
}

main().finally(() => prisma.$disconnect());
