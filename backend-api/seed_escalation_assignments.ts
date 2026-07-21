/**
 * Seed script: escalation_assignments
 * Run with:  npx ts-node seed_escalation_assignments.ts
 *
 * Backfills escalation_level=1 for existing global_assignments
 * and seeds default escalation_assignments for department-level Level 2/3 routing.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Starting escalation assignments seed...\n');

  // ── 1. Backfill escalation_level on global_assignments ────────────────────
  console.log('Step 1: Backfilling escalation_level=1 on existing global_assignments...');
  const updated = await prisma.global_assignments.updateMany({
    where: { escalation_level: null },
    data: { escalation_level: 1 },
  });
  console.log(`  Updated ${updated.count} existing assignment(s) to escalation_level=1\n`);

  // ── 2. List current global_assignments ─────────────────────────────────────
  const assignments = await prisma.global_assignments.findMany({
    orderBy: { routing_key: 'asc' },
    include: { users: { select: { name: true } } },
  });
  console.log('Current global_assignments:');
  for (const a of assignments) {
    console.log(`  ${a.routing_key} → ${a.users?.name ?? 'N/A'} (L${a.escalation_level})`);
  }
  console.log('');

  // ── 3. Seed escalation_assignments table (department-level) ───────────────
  // These provide fallback escalation targets for department-routed tickets.
  // In a real deployment you'd configure these per actual department.
  const depts = await prisma.departments.findMany({ where: { is_active: true } });

  // Get escalation-capable designations
  const level2Desigs = await prisma.designations.findMany({
    where: { is_active: true, can_escalate: true, escalation_level: 2 }
  });
  const level3Desigs = await prisma.designations.findMany({
    where: { is_active: true, can_escalate: true, escalation_level: 3 }
  });

  const l2Names = level2Desigs.map(d => d.name);
  const l3Names = level3Desigs.map(d => d.name);

  // Find a default Level 2 user (first principal/dean)
  const l2User = l2Names.length > 0
    ? await prisma.users.findFirst({ where: { designation: { in: l2Names }, is_active: true } })
    : null;

  // Find a default Level 3 user (first director)
  const l3User = l3Names.length > 0
    ? await prisma.users.findFirst({ where: { designation: { in: l3Names }, is_active: true } })
    : null;

  console.log('Step 2: Seeding department-level escalation_assignments...');
  if (depts.length > 0 && (l2User || l3User)) {
    for (const dept of depts) {
      // Upsert L2
      if (l2User) {
        await prisma.escalation_assignments.upsert({
          where: { department_id_escalation_level: { department_id: dept.id, escalation_level: 2 } },
          create: { department_id: dept.id, escalation_level: 2, user_id: l2User.id, is_active: true },
          update: {},
        });
        console.log(`  [L2] ${dept.name} → ${l2User.name}`);
      }
      // Upsert L3
      if (l3User) {
        await prisma.escalation_assignments.upsert({
          where: { department_id_escalation_level: { department_id: dept.id, escalation_level: 3 } },
          create: { department_id: dept.id, escalation_level: 3, user_id: l3User.id, is_active: true },
          update: {},
        });
        console.log(`  [L3] ${dept.name} → ${l3User.name}`);
      }
    }
  } else {
    console.log('  Skipped — no departments, or no L2/L3 users found in designations.');
  }

  console.log('\n[SEED] escalation_assignments seed complete.\n');
  console.log('📋 Escalation routing is now configured as:');
  console.log('   Global-routed tickets → escalation by routing_key + escalation_level');
  console.log('   Dept-routed tickets   → escalation by department_id + escalation_level');
  console.log('   Admin can configure both via /api/designations and the routing panel.\n');
}

main()
  .catch((e) => { console.error('[SEED ERROR]', e); })
  .finally(() => prisma.$disconnect());
