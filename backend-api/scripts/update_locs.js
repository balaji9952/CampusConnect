const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateLocations() {
  await prisma.locations.updateMany({
    where: { name: 'Canteen' },
    data: { routing_key: 'CANTEEN_HEAD' }
  });
  await prisma.locations.updateMany({
    where: { name: 'Transport' },
    data: { routing_key: 'TRANSPORT_MANAGER' }
  });
  await prisma.locations.updateMany({
    where: { name: 'Boys Hostel' },
    data: { routing_key: 'BOYS_HOSTEL_WARDEN' }
  });
  await prisma.locations.updateMany({
    where: { name: 'Girls Hostel' },
    data: { routing_key: 'GIRLS_HOSTEL_WARDEN' }
  });
  await prisma.locations.updateMany({
    where: { name: 'Boys Mess' },
    data: { routing_key: 'BOYS_MESS_MANAGER' }
  });
  await prisma.locations.updateMany({
    where: { name: 'Girls Mess' },
    data: { routing_key: 'GIRLS_MESS_MANAGER' }
  });
  console.log('Location routing keys updated!');
}

updateLocations().finally(() => prisma.$disconnect());
