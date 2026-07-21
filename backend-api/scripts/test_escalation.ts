import prisma from '../src/utils/prisma';
import { processLevel1ToLevel2, processLevel2ToLevel3 } from '../src/cron/escalation';

async function runTest() {
  const student = await prisma.users.findFirst({ where: { role: 0 } });
  if (!student) throw new Error('No student found');

  const loc = await prisma.locations.findFirst();
  const cat = await prisma.complaint_categories.findFirst();

  // Create Level 1 ticket dated 25 hours ago
  const t1 = await prisma.tickets.create({
    data: {
      id: 'TEST-ESC-L1-' + Date.now(),
      title: 'Test Level 1 Esc',
      description: 'Test',
      location_id: loc!.id,
      location_name: loc!.name,
      category_id: cat!.id,
      category_name: cat!.name,
      priority: 1,
      status: 0,
      escalation_level: 1,
      creator_id: student.id,
      creator_name: student.name,
      creator_role: 'Student',
      created_at: new Date(Date.now() - 25 * 60 * 60 * 1000)
    }
  });

  // Create Level 2 ticket dated 25 hours ago (with history older than 24 hours)
  const t2Id = 'TEST-ESC-L2-' + Date.now();
  const t2 = await prisma.tickets.create({
    data: {
      id: t2Id,
      title: 'Test Level 2 Esc',
      description: 'Test',
      location_id: loc!.id,
      location_name: loc!.name,
      category_id: cat!.id,
      category_name: cat!.name,
      priority: 1,
      status: 0,
      escalation_level: 2,
      creator_id: student.id,
      creator_name: student.name,
      creator_role: 'Student',
      created_at: new Date(Date.now() - 49 * 60 * 60 * 1000),
      escalation_history: {
        create: {
          from_level: 1,
          to_level: 2,
          reason: 'L1',
          escalated_at: new Date(Date.now() - 25 * 60 * 60 * 1000)
        }
      }
    }
  });

  console.log('Created dummy tickets');

  await processLevel1ToLevel2();
  await processLevel2ToLevel3();

  const finalT1 = await prisma.tickets.findUnique({ where: { id: t1.id }, include: { escalation_history: true } });
  const finalT2 = await prisma.tickets.findUnique({ where: { id: t2Id }, include: { escalation_history: true } });

  console.log('T1 Final Level:', finalT1?.escalation_level, 'History Count:', finalT1?.escalation_history.length);
  console.log('T2 Final Level:', finalT2?.escalation_level, 'History Count:', finalT2?.escalation_history.length);

  // Cleanup
  await prisma.tickets.deleteMany({ where: { id: { startsWith: 'TEST-ESC-' } } });
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
