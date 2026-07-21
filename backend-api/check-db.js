const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.users.findMany({ select: { name: true, role: true, department_id: true }}); 
  console.log(users); 
}

main().finally(() => prisma.$disconnect());
