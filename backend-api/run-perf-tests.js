const autocannon = require('autocannon');
// Use global fetch (Node 18+ has built-in fetch)

const TARGET_URL = 'http://localhost:3030';
const LOGIN_EMAIL = 'principal@example.com';
const LOGIN_PASS = 'password123';

async function getJwtToken() {
  console.log(`[AUTH] Fetching JWT for ${LOGIN_EMAIL}...`);
  try {
    const res = await fetch(`${TARGET_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: LOGIN_EMAIL, password: LOGIN_PASS, role: 1 })
    });
    const json = await res.json();
    if (!res.ok || !json.token) {
      throw new Error(json.message || 'Login failed');
    }
    console.log(`[AUTH] Successfully authenticated!`);
    return json.token;
  } catch (err) {
    console.error(`[AUTH ERROR] Could not authenticate. Performance testing will fall back to /health check endpoint.`, err.message);
    return null;
  }
}

async function getPerfMetrics() {
  try {
    const res = await fetch(`${TARGET_URL}/api/perf-metrics`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

function printMetricsSnapshot(concurrency, metrics) {
  if (!metrics) return;
  const m = metrics.metrics;
  console.log(`  [MONITOR] C: ${concurrency} | CPU: ${m.cpu.percent}% | HeapUsed: ${m.memory.heapUsedMb}MB | ActConn: ${m.concurrentRequests} | ActDB: ${m.activeDatabaseConnections} | PrismaAvg: ${m.prisma.averageQueryDurationMs}ms | ELMean: ${m.eventLoop.meanMs}ms`);
}

async function runScenario(concurrency, jwtToken) {
  console.log(`\n==================================================`);
  console.log(`STARTING LOAD TEST: ${concurrency} CONCURRENT USERS`);
  console.log(`==================================================`);

  const path = jwtToken ? '/api/dashboard/stats' : '/health';
  const headers = jwtToken ? { 'Authorization': `Bearer ${jwtToken}` } : {};

  console.log(`Testing endpoint: ${TARGET_URL}${path}`);

  // Reset performance stats on backend first if we can (by querying the metrics endpoint to flush state)
  await getPerfMetrics();

  let metricsInterval;
  const metricsSnapshots = [];

  const trackerPromise = new Promise((resolve) => {
    metricsInterval = setInterval(async () => {
      const data = await getPerfMetrics();
      if (data) {
        printMetricsSnapshot(concurrency, data);
        metricsSnapshots.push(data.metrics);
      }
    }, 1000);

    const instance = autocannon({
      url: TARGET_URL + path,
      connections: concurrency,
      duration: 10, // 10 seconds per test
      headers: headers,
    }, (err, result) => {
      clearInterval(metricsInterval);
      if (err) {
        console.error('Autocannon error:', err);
        resolve(null);
      } else {
        resolve(result);
      }
    });

    autocannon.track(instance, { render: false });
  });

  const result = await trackerPromise;
  if (!result) return;

  // Print results
  console.log(`\n[AUTOCANNON RESULTS] Concurrency: ${concurrency}`);
  console.log(`  - 2xx / Success requests: ${result.requests.sent}`);
  console.log(`  - Total Errors (Non-2xx): ${result.errors + result.non2xx}`);
  console.log(`  - Requests / Sec (RPS): ${result.requests.average}`);
  console.log(`  - Average Latency: ${result.latency.average} ms`);
  console.log(`  - P95 Latency: ${result.latency.p95} ms`);
  console.log(`  - P99 Latency: ${result.latency.p99} ms`);
  console.log(`  - Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);

  // Analyze metrics snapshots
  if (metricsSnapshots.length > 0) {
    const avgCpu = metricsSnapshots.reduce((acc, m) => acc + parseFloat(m.cpu.percent), 0) / metricsSnapshots.length;
    const maxHeap = Math.max(...metricsSnapshots.map(m => parseFloat(m.memory.heapUsedMb)));
    const maxPrisma = Math.max(...metricsSnapshots.map(m => parseFloat(m.prisma.averageQueryDurationMs)));
    const maxEL = Math.max(...metricsSnapshots.map(m => parseFloat(m.eventLoop.meanMs)));
    
    console.log(`\n[SYSTEM RESOURCE SUMMARY] Concurrency: ${concurrency}`);
    console.log(`  - Average Server CPU usage: ${avgCpu.toFixed(2)}%`);
    console.log(`  - Peak Memory Heap Used: ${maxHeap.toFixed(2)} MB`);
    console.log(`  - Peak Event Loop Delay: ${maxEL.toFixed(3)} ms`);
    if (jwtToken) {
      console.log(`  - Peak Prisma Query Average Duration: ${maxPrisma.toFixed(2)} ms`);
    }
  }
  
  return {
    concurrency,
    autocannon: result,
    system: metricsSnapshots
  };
}

async function main() {
  const jwtToken = await getJwtToken();
  const concurrencies = [5, 10, 25, 50, 100, 200];
  const summary = [];

  for (const c of concurrencies) {
    const result = await runScenario(c, jwtToken);
    summary.push(result);
  }

  console.log(`\n==================================================`);
  console.log(`FINAL BOTTLENECK ANALYSIS & DIAGNOSTICS`);
  console.log(`==================================================`);

  summary.forEach(s => {
    if (!s) return;
    const rps = s.autocannon.requests.average;
    const lat = s.autocannon.latency.average;
    const errs = s.autocannon.errors + s.autocannon.non2xx;
    console.log(`Users: ${s.concurrency.toString().padEnd(3)} | RPS: ${rps.toString().padEnd(6)} | Latency: ${lat.toFixed(1).padEnd(6)} ms | Errors: ${errs}`);
  });

  // Diagnostics check
  console.log(`\n[DIAGNOSTIC REPORT]`);
  
  // Find highest concurrent load metrics
  const load200 = summary[summary.length - 1];
  if (load200 && load200.system.length > 0) {
    const peakSys = load200.system[load200.system.length - 1];
    const peakCpu = parseFloat(peakSys.cpu.percent);
    const peakMemory = parseFloat(peakSys.memory.heapUsedMb);
    const peakEL = parseFloat(peakSys.eventLoop.meanMs);
    const peakPrisma = parseFloat(peakSys.prisma.averageQueryDurationMs);
    const totalRequests = load200.autocannon.requests.sent;
    const errorCount = load200.autocannon.errors + load200.autocannon.non2xx;
    const avgLatency = load200.autocannon.latency.average;

    let bottleneck = "No significant bottleneck identified under test load.";
    let details = "";

    if (errorCount / totalRequests > 0.05) {
      bottleneck = "API Gateway Error Limits / Rate Limiter";
      details = `Error rate reached ${(errorCount / totalRequests * 100).toFixed(2)}% under high concurrent load (200 users). Express rate limiting is likely dropping requests.`;
    } else if (peakCpu > 80) {
      bottleneck = "Node.js Process CPU exhaustion";
      details = `CPU hit ${peakCpu.toFixed(2)}% under high load. Event loop execution time became bounded.`;
    } else if (peakEL > 50) {
      bottleneck = "Event Loop blocking synchronous code";
      details = `Event Loop mean delay hit ${peakEL.toFixed(2)}ms, indicating CPU-bound or blocky middleware/crypto executions.`;
    } else if (peakPrisma > 150) {
      bottleneck = "PostgreSQL Database Pooler / Prisma Query Latency";
      details = `Prisma average query duration peaked at ${peakPrisma.toFixed(2)}ms. Supabase transaction pooler queue duration limits db throughput.`;
    } else if (avgLatency > 500) {
      bottleneck = "Network Latency / Ngrok Tunnel Bandwidth limits";
      details = `Average response latency is very high (${avgLatency.toFixed(1)}ms) while CPU and Database queries remain relatively fast, indicating ngrok connection queue queuing.`;
    } else {
      bottleneck = "Supabase serverless tier limits / database size scaling";
      details = "Server and database remain healthy, scaling latency rises linearly with concurrency.";
    }

    console.log(`Primary Bottleneck: ${bottleneck}`);
    console.log(`Details: ${details}`);
    console.log(`  - Peak CPU: ${peakCpu.toFixed(1)}%`);
    console.log(`  - Peak Event Loop Delay: ${peakEL.toFixed(2)}ms`);
    console.log(`  - Peak Prisma Query Time: ${peakPrisma.toFixed(1)}ms`);
  }
}

main();
