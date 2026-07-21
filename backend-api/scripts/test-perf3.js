const { TicketsService } = require('./dist/services/tickets.service');
const prisma = require('./dist/utils/prisma').default;

async function test() {
  const userId = '093e2824-0bfc-419e-953e-cc9a025bb913';
  const data = { title: 'Test', description: 'Test', location_id: 1, category_id: 1, ticket_type: 'PARENT_FEEDBACK', priority: 1 };
  
  console.log('--- WARMUP ---');
  await TicketsService.create(userId, 'Test', 'Student', data, undefined).catch(e => {});
  
  console.log('--- TEST ---');
  const t0 = performance.now();
  await TicketsService.create(userId, 'Test', 'Student', data, undefined).catch(e => {});
  console.log(`Test took ${(performance.now() - t0).toFixed(2)}ms`);
}

test().finally(() => prisma.$disconnect());
