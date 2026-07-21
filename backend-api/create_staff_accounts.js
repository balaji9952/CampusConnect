const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  const password = 'password123';
  const password_hash = await bcrypt.hash(password, 10);

  const staffs = [
    { name: 'Dr. Dean', email: 'dean@example.com', designation: 'Dean', phone: '1000000001', is_privileged: true },
    { name: 'Dr. Director', email: 'director@example.com', designation: 'Director', phone: '1000000002', is_privileged: true },
    { name: 'Dr. Principal', email: 'principal@example.com', designation: 'Principal', phone: '1000000003', is_privileged: true },
  ];

  for (const staff of staffs) {
    // 1. Ensure Designation Exists
    await prisma.designations.upsert({
      where: { name: staff.designation },
      update: {
        is_privileged: staff.is_privileged
      },
      create: {
        name: staff.designation,
        is_privileged: staff.is_privileged,
        description: `${staff.designation} Role`
      }
    });

    // 2. Create User
    const user = await prisma.users.upsert({
      where: { email: staff.email },
      update: {
        designation: staff.designation,
        role: 1, // Staff
      },
      create: {
        id: crypto.randomUUID(),
        name: staff.name,
        email: staff.email,
        password_hash: password_hash,
        role: 1, // Staff
        designation: staff.designation,
        is_active: true
      }
    });
    console.log(`Created/Updated ${staff.designation}: ${user.email} / ${password}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
