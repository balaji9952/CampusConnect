const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const locs = await prisma.locations.findMany({ include: { qr_codes: true }});
  for (const l of locs) {
    console.log(l.name, 'Active:', l.is_active, 'QR count:', l.qr_codes.length);
    if (l.qr_codes.length > 0) {
       console.log('  QR active:', l.qr_codes[0].is_active, 'Token:', l.qr_codes[0].qr_token);
    }
  }
}

main().finally(() => prisma.$disconnect());
