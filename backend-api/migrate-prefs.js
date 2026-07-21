const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.users.findMany({
    where: {
      user_notification_preferences: null
    }
  });

  console.log(`Found ${users.length} users needing default preferences.`);

  let count = 0;
  for (const u of users) {
    try {
      await prisma.user_notification_preferences.create({
        data: {
          user_id: u.id
        }
      });
      count++;
    } catch (e) {
      console.error(`Failed to insert for user ${u.id}:`, e);
    }
  }

  console.log(`Successfully migrated ${count} users.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
