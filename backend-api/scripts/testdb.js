const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    await prisma.$executeRawUnsafe('DROP INDEX UQ_ticket_number ON tickets');
    console.log('Dropped UQ_ticket_number index');
  } catch(e) {
    console.error(e);
  }
}
main().catch(e=>console.log(e)).finally(()=>prisma.$disconnect());
