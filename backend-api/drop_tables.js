const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe('IF OBJECT_ID(\'dbo.user_notification_preferences\', \'U\') IS NOT NULL DROP TABLE dbo.user_notification_preferences;');
  // For user_fcm_tokens, SQL Server prevents dropping tables if they are referenced. Since it's a leaf table, we can just drop it.
  await prisma.$executeRawUnsafe('IF OBJECT_ID(\'dbo.user_fcm_tokens\', \'U\') IS NOT NULL DROP TABLE dbo.user_fcm_tokens;');
  console.log('Dropped tables successfully');
}
main().catch(console.error).finally(() => prisma.$disconnect());
