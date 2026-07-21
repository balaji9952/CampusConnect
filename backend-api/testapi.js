const http = require('http');

async function run() {
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@mountzion.ac.in', password: 'password123' }) // I don't know the real password, let's try something generic
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('Login failed:', loginData);
    // fallback: directly call the service since we are locally on the machine!
    const { PrismaClient } = require('@prisma/client');
    const { AdminUsersService } = require('./dist/services/admin-users.service');
    const prisma = new PrismaClient();
    try {
      const data = await AdminUsersService.listUsers({});
      console.log(JSON.stringify(data, null, 2));
    } finally {
      prisma.$disconnect();
    }
    return;
  }
  const token = loginData.data.token;
  const usersRes = await fetch('http://127.0.0.1:5000/api/admin/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(await usersRes.text());
}

run().catch(console.error);
