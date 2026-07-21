const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const parent = await prisma.users.findFirst({
    where: {
      role: 2 // Wait, what is parent's integer role? Let's query roles first or search
    }
  });
  console.log("Parent user found:", parent);

  const student = await prisma.users.findFirst({
    where: {
      role: 0 // Student role
    }
  });
  console.log("Student user found:", student);

  const allUsers = await prisma.users.findMany({
    take: 10
  });
  console.log("Some users:");
  allUsers.forEach(u => console.log(`Email: ${u.email} | Role: ${u.role} | Name: ${u.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
