const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const locs = await prisma.locations.findMany({ include: { qr_codes: true }});
  for (const l of locs) {
    if (l.qr_codes.length > 0) {
      const url = l.qr_codes[0].qr_image_url;
      const dataMatch = url.match(/data=([^&]+)/);
      if (dataMatch) {
         const decoded = decodeURIComponent(dataMatch[1]);
         console.log(l.name, '=> Payload:', decoded);
      } else {
         console.log(l.name, '=> No data found in URL:', url);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
