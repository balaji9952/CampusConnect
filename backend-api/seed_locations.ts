import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log("Updating existing locations routing configs...");
  
  await prisma.$executeRaw`UPDATE locations SET routing_type = 'GLOBAL_ROUTED', routing_key = 'HOSTEL_WARDEN' WHERE name LIKE '%Hostel%'`;
  await prisma.$executeRaw`UPDATE locations SET routing_type = 'GLOBAL_ROUTED', routing_key = 'CANTEEN_HEAD' WHERE name LIKE '%Canteen%'`;
  await prisma.$executeRaw`UPDATE locations SET routing_type = 'GLOBAL_ROUTED', routing_key = 'LIBRARY_HEAD' WHERE name LIKE '%Library%'`;
  await prisma.$executeRaw`UPDATE locations SET routing_type = 'GLOBAL_ROUTED', routing_key = 'TRANSPORT_MANAGER' WHERE name LIKE '%Transport%'`;
  await prisma.$executeRaw`UPDATE locations SET routing_type = 'GLOBAL_ROUTED', routing_key = 'SANITATION_HEAD' WHERE name LIKE '%Toilet%' OR name LIKE '%Restroom%'`;
  
  // All others default to DEPARTMENT_ROUTED per the schema default
  console.log("Seeding complete.");
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
