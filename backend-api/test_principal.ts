import { PrismaClient } from '@prisma/client';
import { DashboardService } from './src/services/dashboard.service';

const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Fetching Principal Executive Report...');
    const report = await DashboardService.getPrincipalExecutiveReport();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Error fetching report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
