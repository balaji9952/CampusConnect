const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const qrMaster = await prisma.qR_MASTER.findMany({where: { Location: {contains: 'Bus'} }});
  console.log("QR Master (Bus):", qrMaster.length, "items");
  console.log(qrMaster);
}
run().finally(() => prisma.$disconnect());
