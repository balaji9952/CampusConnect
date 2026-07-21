const { PrismaClient } = require('@prisma/client');
const { DepartmentsService } = require('./dist/services/departments.service.js');
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.departments.findMany();
  for (const d of depts) {
     if (d.code === 'ADMIN') continue;
     const dashboard = await DepartmentsService.getDepartmentDashboard(d.id);
     if (dashboard && dashboard.statistics.totalComplaints > 0) {
       console.log(`\n=== Dashboard for ${d.name} ===`);
       console.log(dashboard.statistics);
       console.log(dashboard.staffWorkload);
     }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
