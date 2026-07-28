import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Mark existing HOSTEL as inactive
  const hostelGroup = await prisma.routing_groups.findUnique({
    where: { key: 'HOSTEL' }
  });
  
  if (hostelGroup && hostelGroup.is_active) {
    console.log('Deactivating legacy HOSTEL routing group...');
    await prisma.routing_groups.update({
      where: { key: 'HOSTEL' },
      data: { is_active: false, display_name: '(Deprecated) Hostel' }
    });
  }

  console.log('Fixing sequence...');
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('routing_groups', 'id'), coalesce(max(id), 0) + 1, false) FROM routing_groups;`);

  console.log('Ensuring BOYS_HOSTEL and GIRLS_HOSTEL routing groups exist...');
  
  const boysGroup = await prisma.routing_groups.findUnique({ where: { key: 'BOYS_HOSTEL' } });
  if (!boysGroup) {
    await prisma.routing_groups.create({
      data: {
        key: 'BOYS_HOSTEL',
        display_name: 'Boys Hostel',
        is_system: true,
        is_active: true
      }
    });
  }

  const girlsGroup = await prisma.routing_groups.findUnique({ where: { key: 'GIRLS_HOSTEL' } });
  if (!girlsGroup) {
    await prisma.routing_groups.create({
      data: {
        key: 'GIRLS_HOSTEL',
        display_name: 'Girls Hostel',
        is_system: true,
        is_active: true
      }
    });
  }

  console.log('Migration completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
  });
