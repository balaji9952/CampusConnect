const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const qrMaster = await prisma.qR_MASTER.findMany({where: { entity_type: 'Bus' }});
  if (qrMaster.length > 0) {
     console.log("QR Master (Bus):", qrMaster.length, "items");
     console.log(qrMaster.slice(0, 5));
  }
  
  const qrs = await prisma.qr_codes.findMany();
  console.log("QR Codes:", JSON.stringify(qrs, null, 2));
}
run().finally(() => prisma.$disconnect());
