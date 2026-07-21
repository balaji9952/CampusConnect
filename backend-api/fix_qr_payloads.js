const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allQrs = await prisma.qr_codes.findMany();
  for (const qr of allQrs) {
    const payload = JSON.stringify({ locationId: qr.location_id, token: qr.qr_token });
    const imageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(payload);
    
    if (qr.qr_image_url !== imageUrl) {
       await prisma.qr_codes.update({
         where: { id: qr.id },
         data: { qr_image_url: imageUrl }
       });
       console.log(`✅ Updated QR Image URL for location ID ${qr.location_id}`);
    } else {
       console.log(`⏭️ QR Image URL for location ID ${qr.location_id} is already correct.`);
    }
  }
}

main().finally(() => prisma.$disconnect());
