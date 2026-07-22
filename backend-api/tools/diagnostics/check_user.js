const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.users.findFirst({
      where: { designation: { contains: 'Principal' } }
    });
    console.log("PRINCIPAL DB RECORD:", user);
  } finally {
    await prisma.$disconnect();
  }
}
run();
