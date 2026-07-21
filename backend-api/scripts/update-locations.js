const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.locations.updateMany({
    where: { id: { in: [1, 7] } }, // Academic Block & Computer Lab
    data: { department_id: 7 } // AIDS
  });
  
  await prisma.locations.updateMany({
    where: { id: { in: [3, 8] } }, // Canteen & ECE Lab
    data: { department_id: 4 } // ECE
  });

  console.log("Updated locations to have departments.");
}

main().finally(() => prisma.$disconnect());
