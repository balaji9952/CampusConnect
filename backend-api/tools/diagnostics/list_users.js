const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.users.findMany({
  where: { is_active: true },
  select: { email: true, roll_no: true, designation: true },
  take: 10,
}).then(users => {
  console.log(JSON.stringify(users, null, 2));
  return p.$disconnect();
}).catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
