const fetch = require('node-fetch');
const TARGET_URL = 'http://localhost:3030';
const STUDENT_EMAIL = 'rushanthana9548@mountzion.ac.in';
const STUDENT_PASS = 'password123';

async function main() {
  // Login
  const resAuth = await fetch(`${TARGET_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: STUDENT_EMAIL, password: STUDENT_PASS, role: 0 })
  });
  const jsonAuth = await resAuth.json();
  const token = jsonAuth.token;

  // Insert Parent Feedback location and category if they don't exist
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.locations.upsert({
    where: { name: 'Parent Feedback' },
    update: {},
    create: { name: 'Parent Feedback', is_active: true }
  });
  await prisma.complaint_categories.upsert({
    where: { name: 'Parent Feedback' },
    update: {},
    create: { name: 'Parent Feedback', is_active: true }
  });
  await prisma.$disconnect();

  // Post Ticket
  console.log('Sending single ticket creation request...');
  const resTicket = await fetch(`${TARGET_URL}/api/tickets`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Profile Single Ticket',
      description: 'Profiling time breakdown.',
      location_id: 1,
      category_id: 1,
      ticket_type: 'PARENT_FEEDBACK', // Bypass QR
      priority: 1
    })
  });
  
  const jsonTicket = await resTicket.json();
  console.log(jsonTicket);
}
main();
