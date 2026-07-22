import { PrismaClient } from '@prisma/client';
import { VisibilityService } from '../src/services/visibility.service';

const prisma = new PrismaClient();

async function runTest() {
  console.log('=== Cross-Visibility Test ===');
  // Just testing if the DB queries parse correctly
  try {
    const studentWhere = await VisibilityService.getTicketVisibilityWhereClause('student-id', 'Student');
    console.log('Student Where Clause:', JSON.stringify(studentWhere, null, 2));

    const hodWhere = await VisibilityService.getTicketVisibilityWhereClause('hod-id', 'Staff');
    console.log('HOD Where Clause:', JSON.stringify(hodWhere, null, 2));

    const adminWhere = await VisibilityService.getTicketVisibilityWhereClause('admin-id', 'Admin');
    console.log('Admin Where Clause:', JSON.stringify(adminWhere, null, 2));

    console.log('Test Passed: Queries built successfully');
  } catch (e) {
    console.error('Test Failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
