const autocannon = require('autocannon');

const TARGET_URL = 'http://localhost:3030';
const STUDENT_EMAIL = 'rushanthana9548@mountzion.ac.in';
const STUDENT_PASS = 'password123';

async function getJwtToken() {
  const res = await fetch(`${TARGET_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: STUDENT_EMAIL, password: STUDENT_PASS, role: 0 })
  });
  const json = await res.json();
  if (!res.ok || !json.token) throw new Error(json.message || 'Login failed');
  return { token: json.token, userId: json.user.id };
}

async function getSampleTicketId(token) {
  const res = await fetch(`${TARGET_URL}/api/tickets?limit=1`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await res.json();
  if (res.ok && json.success && json.data && json.data.length > 0) {
    return json.data[0].id;
  }
  return '00000000-0000-0000-0000-000000000000';
}

async function runBenchmark(name, request, connections = 100, duration = 10) {
  console.log(`\n==================================================`);
  console.log(`STARTING BENCHMARK: ${name}`);
  console.log(`==================================================`);
  
  return new Promise((resolve) => {
    const instance = autocannon({
      url: TARGET_URL,
      connections,
      duration,
      requests: [request],
    }, (err, result) => {
      if (err) {
        console.error('Autocannon error:', err);
        resolve(null);
      } else {
        const errors = result.errors + result.non2xx + result.timeouts;
        console.log(`[RESULTS] ${name}`);
        console.log(`  - RPS: ${result.requests.average}`);
        console.log(`  - Avg Latency: ${result.latency.average} ms`);
        console.log(`  - Errors/Timeouts: ${errors} / ${result.requests.sent}`);
        resolve({ name, rps: result.requests.average, latency: result.latency.average, errors });
      }
    });
    autocannon.track(instance, { render: false });
  });
}

async function main() {
  const auth = await getJwtToken();
  const ticketId = await getSampleTicketId(auth.token);
  
  const headers = { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' };
  
  const benchmarks = [
    {
      name: 'Login (POST /api/auth/login)',
      req: {
        method: 'POST',
        path: '/api/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: STUDENT_EMAIL, password: STUDENT_PASS, role: 0 })
      }
    },
    {
      name: 'Get Tickets (GET /api/tickets)',
      req: {
        method: 'GET',
        path: '/api/tickets?limit=10',
        headers
      }
    },
    {
      name: 'Get Ticket Details (GET /api/tickets/:id)',
      req: {
        method: 'GET',
        path: `/api/tickets/${ticketId}`,
        headers
      }
    },
    {
      name: 'Create Ticket (POST /api/tickets)',
      req: {
        method: 'POST',
        path: '/api/tickets',
        headers,
        body: JSON.stringify({
          title: 'Isolated Load Test Ticket',
          description: 'Testing POST endpoint directly.',
          location_id: 1,
          category_id: 1,
          ticket_type: 'PARENT_FEEDBACK', // Bypasses QR requirement
          priority: 1
        })
      }
    },
    {
      name: 'Get Dashboard Stats (GET /api/dashboard/stats)',
      req: {
        method: 'GET',
        path: '/api/dashboard/stats',
        headers
      }
    }
  ];

  const summary = [];
  for (const b of benchmarks) {
    const res = await runBenchmark(b.name, b.req, 100, 10);
    summary.push(res);
  }

  console.log(`\n==================================================`);
  console.log(`FINAL BENCHMARK SUMMARY (100 CONCURRENT USERS)`);
  console.log(`==================================================`);
  for (const s of summary) {
    if (s) {
      console.log(`${s.name.padEnd(45)} | RPS: ${s.rps.toString().padEnd(6)} | Latency: ${s.latency.toFixed(1).padEnd(6)} ms | Errors: ${s.errors}`);
    }
  }
}

main();
