import { PrismaClient } from '@prisma/client';
import { prismaQueryStats } from '../middleware/perf-monitor';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
  ],
});

prisma.$on('query' as any, (e: any) => {
  const duration = e.duration;
  prismaQueryStats.totalQueries++;
  prismaQueryStats.lastQueryTime = Date.now();
  prismaQueryStats.queryDurations.push(duration);
  if (prismaQueryStats.queryDurations.length > 500) {
    prismaQueryStats.queryDurations.shift(); // keep sliding window of last 500 query times
  }
  
  if (duration > prismaQueryStats.maxDuration) {
    prismaQueryStats.maxDuration = duration;
  }
  
  if (duration > 500) { // Slow queries > 500ms
    prismaQueryStats.slowQueries++;
    console.log(`[PRISMA SLOW QUERY] Duration: ${duration}ms | Query: ${e.query} | Params: ${e.params}`);
  }
});

export default prisma;
