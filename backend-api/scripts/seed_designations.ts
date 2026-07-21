/**
 * Seed script: designations
 * Run with:  npx ts-node seed_designations.ts
 *
 * Creates the default designations used throughout the system.
 * Safe to re-run — skips records that already exist.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaults = [
  {
    name: 'Admin',
    description: 'System administrator — full access to all tickets and settings',
    is_privileged: true,
    is_hod: false,
    can_escalate: false,
    escalation_level: null as number | null,
  },
  {
    name: 'Principal',
    description: 'University Principal — Level 2 escalation target',
    is_privileged: true,
    is_hod: false,
    can_escalate: true,
    escalation_level: 2,
  },
  {
    name: 'Director',
    description: 'Director — Level 3 escalation target',
    is_privileged: true,
    is_hod: false,
    can_escalate: true,
    escalation_level: 3,
  },
  {
    name: 'Dean',
    description: 'Dean of Faculty — Level 2 escalation target',
    is_privileged: true,
    is_hod: false,
    can_escalate: true,
    escalation_level: 2,
  },
  {
    name: 'HOD',
    description: 'Head of Department — department-level owner, Level 1 target',
    is_privileged: false,
    is_hod: true,
    can_escalate: true,
    escalation_level: 1,
  },
  {
    name: 'Lab Technician',
    description: 'Lab technician — frontline staff for lab-related complaints',
    is_privileged: false,
    is_hod: false,
    can_escalate: false,
    escalation_level: null as number | null,
  },
  {
    name: 'Super Admin',
    description: 'Super administrator — same access as Admin, for differentiated branding',
    is_privileged: true,
    is_hod: false,
    can_escalate: false,
    escalation_level: null as number | null,
  },
];

async function main() {
  console.log('[SEED] Starting designations seed...');

  for (const d of defaults) {
    const existing = await prisma.designations.findUnique({ where: { name: d.name } });
    if (existing) {
      console.log(`  [SKIP] "${d.name}" already exists`);
    } else {
      await prisma.designations.create({ data: { ...d, is_active: true } });
      console.log(`  [CREATE] "${d.name}" created`);
    }
  }

  console.log('[SEED] designations seed complete.');
  console.log('\n📋 Designations loaded:');
  const all = await prisma.designations.findMany({ orderBy: { name: 'asc' } });
  for (const d of all) {
    const flags = [
      d.is_privileged ? 'PRIVILEGED' : '',
      d.is_hod ? 'HOD' : '',
      d.can_escalate ? `ESCALATE@L${d.escalation_level}` : '',
    ].filter(Boolean).join(', ');
    console.log(`   - ${d.name}: ${flags || 'standard'}`);
  }
}

main()
  .catch((e) => { console.error('[SEED ERROR]', e); })
  .finally(() => prisma.$disconnect());
