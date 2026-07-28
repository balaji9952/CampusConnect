const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const qrs = await prisma.qr_codes.findMany();
  console.log("QR Codes:", qrs.length);
  console.log(qrs);
}
run().finally(() => prisma.$disconnect());
