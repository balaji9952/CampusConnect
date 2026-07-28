import prisma from '../src/utils/prisma';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const locations = await prisma.locations.findMany({
    include: {
      departments: true,
      academic_QR_sublocations: true,
      qr_codes: true,
      tickets: { select: { id: true } }
    }
  });

  const qrCodes = await prisma.qr_codes.findMany();
  const subLocations = await prisma.academic_QR_sublocations.findMany();

  fs.writeFileSync(path.join(__dirname, '../inventory.json'), JSON.stringify({
    locations,
    allQrCodes: qrCodes,
    allSubLocations: subLocations
  }, null, 2), 'utf8');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
