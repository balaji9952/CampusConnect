const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('Testing audit_logs query...');
    const count = await prisma.audit_logs.count();
    console.log('Count:', count);
    
    const logs = await prisma.audit_logs.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        user_id: true,
        user_name: true,
        user_role: true,
        action: true,
        entity_type: true,
        entity_id: true,
        description: true,
        created_at: true
      }
    });
    console.log('Logs retrieved successfully:', logs.length);
  } catch (err) {
    console.error('❌ Query failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
