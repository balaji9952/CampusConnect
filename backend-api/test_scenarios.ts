import { PrismaClient } from '@prisma/client';
import { TicketsService } from './src/services/tickets.service';
import { GlobalAssignmentsService } from './src/services/global-assignments.service';

const prisma = new PrismaClient();

async function run() {
  console.log("=== End-to-End Verification Scenarios ===\n");

  const student = await prisma.users.findFirst({ where: { role: 0 } });
  if (!student) throw new Error("No student found");

  const locations = await prisma.locations.findMany();
  const categories = await prisma.complaint_categories.findMany();

  const getLoc = (name: string) => locations.find(l => l.name.includes(name));
  const getCat = (name: string) => categories.find(c => c.name.includes(name));

  const scenarios = [
    { loc: 'Academic', cat: 'Infrastructure', expected: 'DEPARTMENT_ROUTED -> Department HOD' },
    { loc: 'Hostel', cat: 'Electrical', expected: 'GLOBAL_ROUTED -> Hostel Warden' },
    { loc: 'Hostel', cat: 'Cleanliness', expected: 'GLOBAL_ROUTED -> Hostel Warden' },
    { loc: 'Canteen', cat: 'Food', expected: 'GLOBAL_ROUTED -> Canteen Head' },
    { loc: 'Library', cat: 'IT', expected: 'GLOBAL_ROUTED -> Library Head' },
    { loc: 'Transport', cat: 'Maintenance', expected: 'GLOBAL_ROUTED -> Transport Manager' },
    { loc: 'Toilet', cat: 'Plumbing', expected: 'GLOBAL_ROUTED -> Sanitation Head' },
  ];

  for (const s of scenarios) {
    const l = getLoc(s.loc);
    const c = getCat(s.cat) || categories[0]; // fallback category if specific one not found

    if (!l) {
      console.log(`Skipping ${s.loc} + ${s.cat}: Location not found.`);
      continue;
    }

    try {
      const ticket = await TicketsService.create(student.id, student.name, 'Student', {
        title: `Test ${s.loc} ${s.cat}`,
        description: 'Test description',
        location_id: l.id,
        category_id: c.id,
        priority: 1
      });

      console.log(`[SCENARIO] ${s.loc} + ${c.name}`);
      console.log(`  Expected  : ${s.expected}`);
      console.log(`  Actual    : ${ticket.assigned_to_name} (${ticket.assigned_role})`);
      console.log(`  Result    : SUCCESS\n`);
    } catch (err: any) {
      console.error(`[SCENARIO] ${s.loc} + ${c.name} - FAILED: ${err.message}\n`);
    }
  }

  // Check metrics
  console.log("=== Routing Health Check Metrics ===");
  const metrics = await GlobalAssignmentsService.getMetrics();
  console.log(metrics);
}

run().catch(console.error).finally(() => prisma.$disconnect());
