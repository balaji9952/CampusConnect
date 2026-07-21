const autocannon = require('autocannon');
const fetch = require('node-fetch'); // Built-in fetch exists in node 18+, but let's check if we can use global fetch

const TARGET_URL = 'http://localhost:3030';

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
  console.log(`  [MONITOR] C: ${concurrency} | CPU: ${m.cpu.percent}% | HeapUsed: ${m.memory.heapUsedMb}MB | ActConn: ${m.concurrentRequests} | ActDB: ${m.activeDatabaseConnections} | ELMean: ${m.eventLoop.meanMs}ms`);
}

async function runScenario(concurrency) {
  console.log(`\n==================================================`);
  console.log(`ISOLATION TEST: ${concurrency} CONCURRENT USERS -> /health`);
  console.log(`==================================================`);

  const path = '/health';

  // Reset metrics
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
      duration: 5, // 5 seconds per test is enough to verify health
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
  console.log(`  - Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);

  return result;
}

async function main() {
  console.log('=== STARTING ISOLATION TEST (EXPRESS & NETWORK ONLY) ===');
  const concurrencies = [5, 25, 100, 200];
  for (const c of concurrencies) {
    await runScenario(c);
  }
  console.log('=== ISOLATION TEST COMPLETED ===');
}

main();
