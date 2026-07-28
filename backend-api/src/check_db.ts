import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Department DB Check ---');
  const depts = await prisma.departments.findMany();
  console.log('Current Departments:', depts);

  const locs = await prisma.locations.findMany({ select: { id: true, name: true, department_id: true } });
  console.log('Current Locations with department_ids:', locs.filter((l: any) => l.department_id !== null));

  const users = await prisma.users.findMany({ select: { id: true, name: true, department_id: true } });
  console.log('Users with department_ids count:', users.filter((u: any) => u.department_id !== null).length);

  const esc = await prisma.escalation_assignments.findMany({ select: { id: true, department_id: true, escalation_level: true } });
  console.log('Escalation assignments with department_ids count:', esc.filter((e: any) => e.department_id !== null).length);
}

main().finally(() => prisma.$disconnect());
