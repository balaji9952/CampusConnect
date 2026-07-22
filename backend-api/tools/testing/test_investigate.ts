import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api';

async function investigateIssues() {
  // ─── Issue 1: Auth Login 500 ─────────────────────────────────────────────
  console.log('\n===== ISSUE INVESTIGATION =====\n');
  console.log('── Issue 1: Auth /login 500 ──');
  
  const staffUsers = await prisma.users.findMany({
    where: { role: 1 },
    select: { id: true, email: true, name: true, role: true, is_active: true }
  });
  console.log('Staff users in DB:', JSON.stringify(staffUsers, null, 2));
  
  // The API expects { identifier, role, password } - check what the Flutter app sends
  // Try actual login with correct format
  const loginAttempt = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: staffUsers[0]?.email,
      role: 1,
      password: 'password123'
    })
  });
  const loginBody = await loginAttempt.text();
  console.log(`Login attempt (HTTP ${loginAttempt.status}):`, loginBody.substring(0, 200));

  // ─── Issue 2: GET /tickets/:id 500 ──────────────────────────────────────
  console.log('\n── Issue 2: GET /tickets/:id 500 ──');
  const ticketId = 'TEST-1780756048883';
  const JWT_SECRET = 'f9k2a4mP3vR8cZ1lX7wQ5tB0jH6nS4yE9uD2gL5xV1bM';
  const staffToken = jwt.sign({ id: staffUsers[0]?.id, role: 'Staff', name: staffUsers[0]?.name }, JWT_SECRET, { expiresIn: '1h' });
  
  const detailRes = await fetch(`${API_URL}/tickets/${ticketId}`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  const detailBody = await detailRes.text();
  console.log(`GET /tickets/${ticketId} HTTP ${detailRes.status}:`, detailBody.substring(0, 500));

  // ─── Issue 3: Dashboard resolved vs escalated mismatch ───────────────────
  console.log('\n── Issue 3: Dashboard status enum mismatch ──');
  
  const sqlCounts = await prisma.$queryRaw<any[]>`
    SELECT status, COUNT(*) as count FROM tickets WHERE is_deleted = 0 GROUP BY status
  `;
  console.log('SQL status counts (raw):', JSON.stringify(sqlCounts, null, 2));
  
  const dashRes = await fetch(`${API_URL}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  const dashData = await dashRes.json() as any;
  console.log('Dashboard API response:', JSON.stringify(dashData?.data, null, 2));

  await prisma.$disconnect();
}

investigateIssues().catch(console.error);
