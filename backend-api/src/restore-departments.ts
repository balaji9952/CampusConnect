import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreDepartments() {
  console.log('--- Starting IT & MBA Department Restoration ---');

  const deptsToRestore = [
    { name: 'Information Technology', code: 'IT' },
    { name: 'Master of Business Administration', code: 'MBA' }
  ];

  const restoredIds: number[] = [];

  for (const dept of deptsToRestore) {
    // 1. Idempotent Department Creation
    let department = await prisma.departments.findFirst({
      where: { name: dept.name }
    });

    if (department) {
      console.log(`[Department] '${dept.name}' already exists with ID: ${department.id}. Skipping creation.`);
    } else {
      department = await prisma.departments.create({
        data: {
          name: dept.name,
          code: dept.code,
          is_active: true,
          // hod_user_id is nullable, left blank per user instructions.
        }
      });
      console.log(`[Department] Successfully created '${dept.name}' with ID: ${department.id}`);
    }

    restoredIds.push(department.id);

    // 2. Routing Configuration
    // The escalation_assignments table requires a valid user_id (not nullable). 
    // Since we don't have placeholder users, we will skip creating escalation_assignments 
    // for now and let them be configured later through the Admin Portal, perfectly 
    // adhering to the directive: "leave the assignments blank and configure them later".
  }

  console.log('--- Restoration Completed ---');
  console.log(`Restored Department IDs: ${restoredIds.join(', ')}`);
}

restoreDepartments()
  .catch(e => {
    console.error('Error during restoration:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
