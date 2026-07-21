const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const user = await prisma.users.findFirst({ where: { designation: 'HOD' } });
  if (!user) return console.log('no HOD');
  console.log('HOD ID:', user.id);
  const notifs = await prisma.notifications.findMany({ where: { user_id: user.id } });
  console.log(notifs.length, 'personal notifs');
  const privNotifs = await prisma.notifications.findMany({ where: { privileged_only: true, user_id: null } });
  console.log(privNotifs.length, 'privileged notifs');
}
run().finally(() => prisma.$disconnect());
