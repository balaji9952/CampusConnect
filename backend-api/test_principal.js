const { DashboardService } = require('./dist/services/dashboard.service.js');
const { PrismaClient } = require('@prisma/client');

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
