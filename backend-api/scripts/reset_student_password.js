const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const principal = await prisma.users.findFirst({
    where: { email: 'principal@example.com' }
  });
  
  if (!principal) {
    throw new Error('Principal user not found to copy hash.');
  }

  const studentEmail = 'rushanthana9548@mountzion.ac.in';
  const updated = await prisma.users.update({
    where: { email: studentEmail },
    data: {
      password_hash: principal.password_hash
    }
  });

  console.log(`[SUCCESS] Reset password for student ${studentEmail} to match principal (password123).`);
  console.log("Updated user:", updated.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
