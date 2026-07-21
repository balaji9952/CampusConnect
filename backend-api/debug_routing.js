const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== global_assignments for LIBRARY_HEAD ===');
  const assignments = await prisma.global_assignments.findMany({
    where: { routing_key: 'LIBRARY_HEAD' },
    include: { users: { select: { id: true, name: true, designation: true } } },
    orderBy: { escalation_level: 'asc' }
  });

  for (const a of assignments) {
    console.log(`  ID: ${a.id} | level: ${a.escalation_level} | is_active: ${a.is_active} | user: ${a.users?.name} (${a.users?.designation})`);
  }

  console.log('\n=== Library Location routing config ===');
  const loc = await prisma.locations.findFirst({ where: { name: { contains: 'Library', mode: 'insensitive' } } });
  console.log(`  Name: ${loc?.name} | routing_type: ${loc?.routing_type} | routing_key: ${loc?.routing_key}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
