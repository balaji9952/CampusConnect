import prisma from './utils/prisma';

async function main() {
  console.log('Running test-db-query...');
  try {
    const users = await prisma.users.findMany({
      take: 2,
      select: { name: true }
    });
    console.log('Success! Users:', users);
  } catch (err: any) {
    console.error('Connection failed:', err.message);
    console.error(err.stack);
  }
}

main().finally(() => prisma.$disconnect());
