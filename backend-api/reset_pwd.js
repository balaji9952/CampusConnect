const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@mountzion.ac.in';
  const newPassword = 'Admin@123';
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  const user = await prisma.users.update({
    where: { email: email },
    data: { password_hash: passwordHash }
  });
  
  console.log('Password reset successfully for:', user.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
