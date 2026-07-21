import { Request, Response, NextFunction } from 'express';
import { monitorEventLoopDelay } from 'perf_hooks';
import prisma from '../utils/prisma';

// Initialize Event Loop Monitor
const elMonitor = monitorEventLoopDelay({ resolution: 10 });
elMonitor.enable();

// Keep track of runtime statistics
let concurrentRequests = 0;
let totalRequests = 0;
let errorRequests = 0;
let totalBytesSent = 0;

// Stats over time intervals
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = process.hrtime();
let currentCpuPercent = 0;

// Prisma logging connection
export const prismaQueryStats = {
  totalQueries: 0,
  slowQueries: 0,
  maxDuration: 0,
  lastQueryTime: 0,
  queryDurations: [] as number[],
};

// Monitor CPU Usage in the background every 1 second
setInterval(() => {
  const hrTime = process.hrtime(lastCpuTime);
  const cpuUsage = process.cpuUsage(lastCpuUsage);
  
  lastCpuUsage = cpuUsage;
  lastCpuTime = process.hrtime();
  
  const elapTimeMs = hrTime[0] * 1000 + hrTime[1] / 1000000;
  const cpuTimeMs = (cpuUsage.user + cpuUsage.system) / 1000;
  
  currentCpuPercent = (cpuTimeMs / elapTimeMs) * 100;
}, 1000);

export function performanceMonitorMiddleware(req: Request, res: Response, next: NextFunction) {
  concurrentRequests++;
  totalRequests++;
  
  const startHrTime = process.hrtime.bigint();
  
  // Hook the finish event
  res.on('finish', () => {
    concurrentRequests--;
    const endHrTime = process.hrtime.bigint();
    const durationMs = Number(endHrTime - startHrTime) / 1000000; // nanoseconds to milliseconds
    
    // Track bytes sent
    const contentLength = res.get('Content-Length');
    if (contentLength) {
      totalBytesSent += parseInt(contentLength, 10);
    }
    
    // Track errors
    if (res.statusCode >= 400) {
      errorRequests++;
    }
    
    // Log performance metrics for slow requests (> 200ms)
    if (durationMs > 200) {
      console.log(`[PERF WARNING] Slow Request: ${req.method} ${req.originalUrl} took ${durationMs.toFixed(2)}ms | Status: ${res.statusCode}`);
    }
  });

  next();
}

export async function getPerformanceMetrics(req: Request, res: Response) {
  const mem = process.memoryUsage();
  
  // Query Active connections in PostgreSQL database if possible
  let activeDbConnections = -1;
  try {
    const dbResult: any = await prisma.$queryRawUnsafe("SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'");
    activeDbConnections = Number(dbResult[0]?.count || 0);
  } catch (err) {
    // If permission or feature is denied, fallback
    activeDbConnections = -2; 
  }

  // Calculate event loop delay
  const elMin = elMonitor.min / 1000000;
  const elMax = elMonitor.max / 1000000;
  const elMean = elMonitor.mean / 1000000;
  const elStdDev = elMonitor.stddev / 1000000;
  
  // Calculate average prisma query duration
  const prismaDurations = prismaQueryStats.queryDurations;
  const avgPrismaDuration = prismaDurations.length > 0
    ? (prismaDurations.reduce((a, b) => a + b, 0) / prismaDurations.length)
    : 0;

  res.json({
    timestamp: new Date().toISOString(),
    metrics: {
      cpu: {
        percent: currentCpuPercent.toFixed(2),
      },
      memory: {
        rssMb: (mem.rss / 1024 / 1024).toFixed(2),
        heapTotalMb: (mem.heapTotal / 1024 / 1024).toFixed(2),
        heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(2),
        externalMb: (mem.external / 1024 / 1024).toFixed(2),
      },
      eventLoop: {
        minMs: elMin.toFixed(3),
        maxMs: elMax.toFixed(3),
        meanMs: elMean.toFixed(3),
        stddevMs: elStdDev.toFixed(3),
      },
      concurrentRequests,
      activeDatabaseConnections: activeDbConnections,
      prisma: {
        totalQueries: prismaQueryStats.totalQueries,
        slowQueries: prismaQueryStats.slowQueries,
        maxQueryDurationMs: prismaQueryStats.maxDuration,
        averageQueryDurationMs: avgPrismaDuration.toFixed(2),
      },
      traffic: {
        totalRequests,
        errorRequests,
        errorRatePercent: totalRequests > 0 ? ((errorRequests / totalRequests) * 100).toFixed(2) : "0.00",
        totalBytesSent,
      }
    }
  });
}
