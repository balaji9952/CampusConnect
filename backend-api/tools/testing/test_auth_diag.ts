import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api';

async function diagAuth() {
  // The 500 in the test was because we sent { email, password } but the API expects { identifier, role, password }
  // Verify: sending wrong body shape → 500 (not 400) is a bug in the login controller
  
  // Wrong shape (Flutter sends email + password, not identifier + role + password)
  const r1 = await fetch(`${API_URL}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rbalaji0220@gmail.com', password: 'admin123' })
  });
  console.log(`Wrong body shape → HTTP ${r1.status}:`, await r1.text());

  // Correct shape
  const r2 = await fetch(`${API_URL}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'rbalaji0220@gmail.com', role: 1, password: 'admin123' })
  });
  console.log(`Correct body shape (wrong pw) → HTTP ${r2.status}:`, await r2.text());

  // Check what password the Flutter app sends for login
  // Look at auth_service.dart
  await prisma.$disconnect();
}
diagAuth().catch(console.error);
