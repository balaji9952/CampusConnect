/**
 * seed_locations_v2.ts
 * Clears and seeds the full set of campus locations with correct categories and routing types,
 * and auto-generates QR codes for each location.
 *
 * Run after compiling: node dist/seed_locations_v2.js
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

interface LocationSeed {
  name: string;
  block?: string;
  routingType: 'GLOBAL_ROUTED' | 'DEPARTMENT_ROUTED';
  routingKey?: string;
  category: string;
}

const LOCATIONS: LocationSeed[] = [
  // ── GLOBAL_ROUTED (go to specific staff via global_assignments) ──────────
  { name: 'Transport',     block: 'Transport Yard', routingType: 'GLOBAL_ROUTED', routingKey: 'transport',    category: 'Transport' },
  { name: 'Boys Hostel',   block: 'Hostel Block A', routingType: 'GLOBAL_ROUTED', routingKey: 'boys-hostel',  category: 'Hostel' },
  { name: 'Girls Hostel',  block: 'Hostel Block B', routingType: 'GLOBAL_ROUTED', routingKey: 'girls-hostel', category: 'Hostel' },
  { name: 'Boys Mess',     block: 'Mess Complex',   routingType: 'GLOBAL_ROUTED', routingKey: 'boys-mess',    category: 'Canteen' },
  { name: 'Girls Mess',    block: 'Mess Complex',   routingType: 'GLOBAL_ROUTED', routingKey: 'girls-mess',   category: 'Canteen' },
  { name: 'Canteen',       block: 'Main Campus',    routingType: 'GLOBAL_ROUTED', routingKey: 'canteen',      category: 'Canteen' },
  // ── DEPARTMENT_ROUTED (go to student's department HOD) ───────────────────
  { name: 'Academic Block', block: 'Main Building',  routingType: 'DEPARTMENT_ROUTED', category: 'Academic' },
  { name: 'Library',        block: 'Library Wing',   routingType: 'DEPARTMENT_ROUTED', category: 'Library' },
  { name: 'Toilet',         block: 'Various',        routingType: 'DEPARTMENT_ROUTED', category: 'General' },
  { name: 'Other',          block: 'Campus',         routingType: 'DEPARTMENT_ROUTED', category: 'General' },
];

function buildQrPayload(locationId: number, token: string): string {
  return JSON.stringify({ locationId, token });
}

function buildQrImageUrl(payload: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`;
}

async function main() {
  console.log('🌱 Deleting all existing locations, QR codes, and sub-locations for a clean seed...\n');
  
  await prisma.academic_QR_sublocations.deleteMany({});
  await prisma.qr_codes.deleteMany({});
  await prisma.locations.deleteMany({});

  console.log('🌱 Seeding fresh campus locations...\n');

  for (const loc of LOCATIONS) {
    const location = await prisma.locations.create({
      data: {
        name:         loc.name,
        block:        loc.block ?? null,
        routing_type: loc.routingType,
        routing_key:  loc.routingKey ?? null,
        category:     loc.category,
        is_active:    true,
      },
    });

    // Generate a cryptographically secure QR token (256-bit entropy, hex)
    const qrToken   = randomBytes(32).toString('hex');
    const payload   = buildQrPayload(location.id, qrToken);
    const imageUrl  = buildQrImageUrl(payload);

    await prisma.qr_codes.create({
      data: {
        location_id:  location.id,
        qr_token:     qrToken,
        qr_image_url: imageUrl,
        is_active:    true,
      },
    });

    console.log(`  🆕 ${loc.name} (id=${location.id}) — QR generated [${loc.category} / ${loc.routingType}${loc.routingKey ? ` / ${loc.routingKey}` : ''}]`);
  }

  console.log('\n✅ Location seed complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
