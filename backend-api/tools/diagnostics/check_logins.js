const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const users = await prisma.users.findMany({
      orderBy: { last_login_at: 'desc' },
      take: 5
    });
    console.log("RECENT USERS:", users.map(u => ({ email: u.email, role: u.role, designation: u.designation, last_login_at: u.last_login_at })));
  } finally {
    await prisma.$disconnect();
  }
}
run();
