const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  await prisma.$queryRaw`SELECT 1`; // warm up
  
  console.time('query');
  const userId = '093e2824-0bfc-419e-953e-cc9a025bb913';
  const departmentId = 1; 
  const records = await prisma.$queryRaw`
    EXPLAIN ANALYZE SELECT ta.ticket_id 
    FROM ticket_assignments ta
    LEFT JOIN users u ON ta.assigned_to_user_id = u.id
    WHERE u.department_id = ${departmentId}
    AND NOT EXISTS (
      SELECT 1 
      FROM ticket_assignments ta2 
      WHERE ta2.ticket_id = ta.ticket_id 
      AND (ta2.assigned_at > ta.assigned_at OR (ta2.assigned_at = ta.assigned_at AND ta2.id > ta.id))
    )
  `;
  console.timeEnd('query');
}
test().catch(console.error).finally(() => prisma.$disconnect());
