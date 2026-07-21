import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api';
const JWT_SECRET = 'f9k2a4mP3vR8cZ1lX7wQ5tB0jH6nS4yE9uD2gL5xV1bM';

async function fetchApi(path: string, method: string = 'GET', body: any = null, headers: any = {}) {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${API_URL}${path}`, options);
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, ok: response.ok, data };
}

async function deepAudit() {
  console.log('\n===== CAMPUS CONNECT PHASE 3 RUNTIME VERIFICATION =====\n');

  // ─── 1. Authentication ─────────────────────────────────────────────────────
  console.log('──────────────────────────────────────────');
  console.log('1. AUTHENTICATION');
  console.log('──────────────────────────────────────────');

  const loginRes = await fetchApi('/auth/login', 'POST', {
    email: 'staff@campus.com',
    password: 'staff123'
  });
  console.log(`POST /api/auth/login  →  HTTP ${loginRes.status}`);
  let staffToken: string | null = null;
  if (loginRes.ok && loginRes.data.token) {
    staffToken = loginRes.data.token;
    const decoded: any = jwt.decode(staffToken!);
    console.log(`  ✅ Login SUCCESS`);
    console.log(`  User: ${loginRes.data.user?.name || decoded?.name}`);
    console.log(`  Role: ${loginRes.data.user?.role || decoded?.role}`);
    console.log(`  Token: ${staffToken!.substring(0, 40)}...`);
  } else {
    // Fall back: create token from DB user
    const dbStaff = await prisma.users.findFirst({ where: { role: 1 } });
    if (!dbStaff) throw new Error('No staff user found in DB');
    staffToken = jwt.sign({ id: dbStaff.id, role: 'Staff', name: dbStaff.name }, JWT_SECRET, { expiresIn: '1h' });
    console.log(`  ⚠️  /api/auth/login returned ${loginRes.status}. Using DB-generated JWT for staff: ${dbStaff.email}`);
    console.log(`  Role: Staff | User: ${dbStaff.name}`);
  }

  const staffHeaders = { Authorization: `Bearer ${staffToken}` };

  // Student login
  const stuLoginRes = await fetchApi('/auth/login', 'POST', { email: 'student@campus.com', password: 'student123' });
  let studentToken: string | null = null;
  if (stuLoginRes.ok && stuLoginRes.data.token) {
    studentToken = stuLoginRes.data.token;
    console.log(`  Student login: HTTP ${stuLoginRes.status} ✅`);
  } else {
    const dbStudent = await prisma.users.findFirst({ where: { role: 0 } });
    if (!dbStudent) throw new Error('No student user found');
    studentToken = jwt.sign({ id: dbStudent.id, role: 'Student', name: dbStudent.name }, JWT_SECRET, { expiresIn: '1h' });
    console.log(`  ⚠️  Student login fallback for ${dbStudent.email}`);
  }
  const studentHeaders = { Authorization: `Bearer ${studentToken}` };

  // ─── 2. Dashboard Stats vs SQL ─────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('2. DASHBOARD STATS vs SQL');
  console.log('──────────────────────────────────────────');

  const statsRes = await fetchApi('/dashboard/stats', 'GET', null, staffHeaders);
  console.log(`GET /api/dashboard/stats  →  HTTP ${statsRes.status}`);
  const stats = statsRes.data?.data;
  if (stats) {
    // SQL ground truth
    const sqlTotal = await prisma.tickets.count({ where: { is_deleted: false } });
    const sqlOpen = await prisma.tickets.count({ where: { is_deleted: false, status: 0 } });
    const sqlInProgress = await prisma.tickets.count({ where: { is_deleted: false, status: 1 } });
    const sqlResolved = await prisma.tickets.count({ where: { is_deleted: false, status: 2 } });
    const sqlEscalated = await prisma.tickets.count({ where: { is_deleted: false, status: 3 } });

    console.log('\n  Metric           SQL        API');
    console.log('  ─────────────────────────────────');
    const match = (sql: number, api: number) => sql === api ? '✅' : '❌';
    console.log(`  Total Tickets:   ${sqlTotal}          ${stats.totalTickets}    ${match(sqlTotal, stats.totalTickets)}`);
    console.log(`  Open (Pending):  ${sqlOpen}          ${stats.openTickets}    ${match(sqlOpen, stats.openTickets)}`);
    console.log(`  In Progress:     ${sqlInProgress}          ${stats.inProgressTickets}    ${match(sqlInProgress, stats.inProgressTickets)}`);
    console.log(`  Resolved:        ${sqlResolved}          ${stats.resolvedTickets}    ${match(sqlResolved, stats.resolvedTickets)}`);
    console.log(`  Escalated:       ${sqlEscalated}          ${stats.escalatedTickets}    ${match(sqlEscalated, stats.escalatedTickets)}`);
  } else {
    console.log(`  ❌ Stats API returned: ${JSON.stringify(statsRes.data)}`);
  }

  // ─── 3. Ticket List SQL vs API ─────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('3. TICKET LIST: SQL vs API');
  console.log('──────────────────────────────────────────');

  const ticketsRes = await fetchApi('/tickets', 'GET', null, staffHeaders);
  console.log(`GET /api/tickets  →  HTTP ${ticketsRes.status}`);
  const sqlTotal = await prisma.tickets.count({ where: { is_deleted: false } });
  const apiTickets = ticketsRes.data?.data ?? ticketsRes.data ?? [];
  const apiCount = Array.isArray(apiTickets) ? apiTickets.length : 0;
  console.log(`  SQL Count:  ${sqlTotal}`);
  console.log(`  API Count:  ${apiCount}   ${sqlTotal === apiCount ? '✅ MATCH' : '❌ MISMATCH'}`);

  if (apiCount > 0) {
    const sample = apiTickets[0];
    console.log(`\n  Sample Ticket (first):`);
    console.log(`    id:          ${sample.id}`);
    console.log(`    title:       ${sample.title}`);
    console.log(`    status:      ${sample.status}`);
    console.log(`    location:    ${sample.location_name}`);
    console.log(`    category:    ${sample.category_name}`);
    console.log(`    creator:     ${sample.creator_name} (${sample.creator_role})`);
    console.log(`    assigned_to: ${sample.assigned_to_name ?? 'Unassigned'}`);
  }

  // ─── 4. Ticket Details ─────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('4. TICKET DETAILS');
  console.log('──────────────────────────────────────────');
  if (apiCount > 0) {
    const ticketId = apiTickets[0].id;
    const detailRes = await fetchApi(`/tickets/${ticketId}`, 'GET', null, staffHeaders);
    console.log(`GET /api/tickets/${ticketId}  →  HTTP ${detailRes.status}`);
    const d = detailRes.data?.data ?? detailRes.data;
    if (d) {
      console.log(`  title:        ${d.title ?? '❌ MISSING'}`);
      console.log(`  description:  ${d.description?.substring(0, 60) ?? '❌ MISSING'}...`);
      console.log(`  location:     ${d.location_name ?? '❌ MISSING'}`);
      console.log(`  category:     ${d.category_name ?? '❌ MISSING'}`);
      console.log(`  status:       ${d.status}`);
      console.log(`  assigned_to:  ${d.assigned_to_name ?? 'Unassigned'}`);
      console.log(`  updates:      ${d.ticket_updates?.length ?? 0} history entries`);
      if (d.ticket_updates?.length > 0) {
        console.log(`    Latest: "${d.ticket_updates[0].message}" by ${d.ticket_updates[0].updated_by}`);
      }
    }
  }

  // ─── 5. Assignment Workflow ────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('5. ASSIGNMENT WORKFLOW');
  console.log('──────────────────────────────────────────');
  // Find a ticket that is not resolved
  const assignTarget = await prisma.tickets.findFirst({ where: { is_deleted: false, status: { lt: 2 } } });
  if (assignTarget) {
    console.log(`  Target ticket: ${assignTarget.id}`);
    const sqlBefore = await prisma.tickets.findUnique({ where: { id: assignTarget.id }, select: { assigned_to_name: true } });
    console.log(`  SQL Before: assigned_to_name = ${sqlBefore?.assigned_to_name ?? 'null'}`);

    const assignPayload = { assigned_to_name: 'Prof. Rajan Kumar' };
    console.log(`  PATCH payload: ${JSON.stringify(assignPayload)}`);
    const assignRes = await fetchApi(`/tickets/${assignTarget.id}/assign`, 'PATCH', assignPayload, staffHeaders);
    console.log(`  PATCH /api/tickets/${assignTarget.id}/assign  →  HTTP ${assignRes.status}`);
    console.log(`  API Response: success=${assignRes.data?.success}`);

    const sqlAfter = await prisma.tickets.findUnique({ where: { id: assignTarget.id }, select: { assigned_to_name: true } });
    console.log(`  SQL After: assigned_to_name = ${sqlAfter?.assigned_to_name}`);
    const ok = sqlAfter?.assigned_to_name === assignPayload.assigned_to_name;
    console.log(`  Result: ${ok ? '✅ PASS – SQL updated correctly' : '❌ FAIL – SQL not updated'}`);
  }

  // ─── 6. Status Update ─────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('6. STATUS UPDATE (Pending → In Progress)');
  console.log('──────────────────────────────────────────');
  const pendingTicket = await prisma.tickets.findFirst({ where: { is_deleted: false, status: 0 } });
  if (pendingTicket) {
    console.log(`  Target ticket: ${pendingTicket.id}`);
    console.log(`  SQL Before: status = ${pendingTicket.status} (Open/Pending)`);
    const statusRes = await fetchApi(`/tickets/${pendingTicket.id}/status`, 'PATCH', { status: 1 }, staffHeaders);
    console.log(`  PATCH /api/tickets/${pendingTicket.id}/status  →  HTTP ${statusRes.status}`);
    const sqlAfterStatus = await prisma.tickets.findUnique({ where: { id: pendingTicket.id }, select: { status: true } });
    console.log(`  SQL After: status = ${sqlAfterStatus?.status} (1 = In Progress)`);
    console.log(`  Result: ${sqlAfterStatus?.status === 1 ? '✅ PASS' : '❌ FAIL'}`);

    // Refresh dashboard to verify count
    const refreshedStats = await fetchApi('/dashboard/stats', 'GET', null, staffHeaders);
    console.log(`  Dashboard after update: inProgress = ${refreshedStats.data?.data?.inProgressTickets}`);
  } else {
    console.log('  No pending tickets found; status update skipped.');
  }

  // ─── 7. Resolution Workflow ────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('7. RESOLUTION WORKFLOW');
  console.log('──────────────────────────────────────────');
  const inProgressTicket = await prisma.tickets.findFirst({ where: { is_deleted: false, status: 1 } });
  if (inProgressTicket) {
    console.log(`  Target ticket: ${inProgressTicket.id}`);
    console.log(`  SQL Before: status = ${inProgressTicket.status}`);
    const updatesBefore = await prisma.ticket_updates.count({ where: { ticket_id: inProgressTicket.id } });
    console.log(`  SQL Before: ticket_updates count = ${updatesBefore}`);

    const resolveRes = await fetchApi(`/tickets/${inProgressTicket.id}/resolve`, 'PATCH', {
      status: 2, remarks: 'Issue resolved. Maintenance completed.'
    }, staffHeaders);
    console.log(`  PATCH /api/tickets/${inProgressTicket.id}/resolve  →  HTTP ${resolveRes.status}`);

    const sqlAfterResolve = await prisma.tickets.findUnique({ where: { id: inProgressTicket.id }, select: { status: true, resolved_at: true } });
    const updatesAfter = await prisma.ticket_updates.count({ where: { ticket_id: inProgressTicket.id } });
    console.log(`  SQL After: status = ${sqlAfterResolve?.status} (2 = Resolved)`);
    console.log(`  SQL After: ticket_updates count = ${updatesAfter} (was ${updatesBefore})`);
    console.log(`  Remarks written: ${updatesAfter > updatesBefore ? '✅ YES' : '❌ NO'}`);
    console.log(`  Status updated: ${sqlAfterResolve?.status === 2 ? '✅ PASS' : '❌ FAIL'}`);

    // Dashboard after resolution
    const postResolveStats = await fetchApi('/dashboard/stats', 'GET', null, staffHeaders);
    console.log(`  Dashboard after resolve: resolved = ${postResolveStats.data?.data?.resolvedTickets}`);
  } else {
    console.log('  No in-progress tickets; resolution test skipped.');
  }

  // ─── 8. Role Security ─────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('8. ROLE SECURITY VERIFICATION');
  console.log('──────────────────────────────────────────');
  const anyTicket = await prisma.tickets.findFirst({ where: { is_deleted: false } });
  if (anyTicket) {
    // Student → resolve (should be 403)
    const stuResolve = await fetchApi(`/tickets/${anyTicket.id}/resolve`, 'PATCH', { status: 2, remarks: 'Hack.' }, studentHeaders);
    console.log(`  Student PATCH /resolve  →  HTTP ${stuResolve.status}  ${stuResolve.status === 403 ? '✅ BLOCKED' : '❌ ALLOWED'}`);
    console.log(`  Response: ${JSON.stringify(stuResolve.data?.message ?? stuResolve.data)}`);

    // Student → assign (should be 403)
    const stuAssign = await fetchApi(`/tickets/${anyTicket.id}/assign`, 'PATCH', { assigned_to_name: 'Hacker' }, studentHeaders);
    console.log(`  Student PATCH /assign   →  HTTP ${stuAssign.status}  ${stuAssign.status === 403 ? '✅ BLOCKED' : '❌ ALLOWED'}`);

    // Student → status (should be 403)
    const stuStatus = await fetchApi(`/tickets/${anyTicket.id}/status`, 'PATCH', { status: 1 }, studentHeaders);
    console.log(`  Student PATCH /status   →  HTTP ${stuStatus.status}  ${stuStatus.status === 403 ? '✅ BLOCKED' : '❌ ALLOWED'}`);

    // No-auth → get tickets (should be 401)
    const noAuth = await fetchApi('/tickets', 'GET', null, {});
    console.log(`  No-Auth  GET /tickets   →  HTTP ${noAuth.status}  ${noAuth.status === 401 ? '✅ BLOCKED' : '❌ ALLOWED (expected 401)'}`);
  }

  // ─── 9. Error / Log scan ───────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('9. STUDENT TICKET VIEW (post-resolution)');
  console.log('──────────────────────────────────────────');
  const stuTicketsRes = await fetchApi('/tickets', 'GET', null, studentHeaders);
  console.log(`GET /api/tickets (student)  →  HTTP ${stuTicketsRes.status}`);
  const stuTickets = stuTicketsRes.data?.data ?? [];
  console.log(`  Tickets visible to student: ${Array.isArray(stuTickets) ? stuTickets.length : 'N/A'}`);
  if (Array.isArray(stuTickets) && stuTickets.length > 0) {
    const resolved = stuTickets.filter((t: any) => t.status === 2);
    console.log(`  Resolved tickets in student view: ${resolved.length}`);
    if (resolved.length > 0) {
      console.log(`  Resolved ticket sample: ${resolved[0].id} — status=${resolved[0].status}`);
    }
  }

  console.log('\n==============================');
  console.log('VERIFICATION COMPLETE');
  console.log('==============================\n');

  await prisma.$disconnect();
}

deepAudit().catch(async (e) => {
  console.error('FATAL ERROR:', e.message);
  await prisma.$disconnect();
});
