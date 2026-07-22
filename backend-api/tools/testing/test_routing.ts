import { PrismaClient } from '@prisma/client';
import { TicketsService } from '../src/services/tickets.service';

const prisma = new PrismaClient();

async function run() {
  // Find a student
  const student = await prisma.users.findFirst({ where: { role: 0 } });
  if (!student) throw new Error("No student found");

  // Find Hostel location
  const hostel = await prisma.locations.findFirst({ where: { name: { contains: 'Hostel' } } });
  if (!hostel) throw new Error("No Hostel location found");

  // Find Academic location
  const academic = await prisma.locations.findFirst({ where: { name: { contains: 'Academic' } } });
  
  // Find Categories
  const electrical = await prisma.complaint_categories.findFirst({ where: { name: { contains: 'Electrical' } } });
  const infra = await prisma.complaint_categories.findFirst({ where: { name: { contains: 'Infrastructure' } } });

  console.log(`Testing with Student: ${student.name}`);
  console.log(`Hostel Location ID: ${hostel.id}, Academic Location ID: ${academic?.id}`);
  
  if (electrical) {
    const t1 = await TicketsService.create(student.id, student.name, 'Student', {
      title: 'Hostel Light Broken',
      description: 'Fix the light',
      location_id: hostel.id,
      category_id: electrical.id,
      priority: 1
    });
    console.log(`Test 1 (Hostel + Electrical) Assignee: ${t1.assigned_to_name} (${t1.assigned_role})`);
  }

  if (academic && infra) {
    const t2 = await TicketsService.create(student.id, student.name, 'Student', {
      title: 'Classroom Projector Broken',
      description: 'Fix the projector',
      location_id: academic.id,
      category_id: infra.id,
      priority: 1
    });
    console.log(`Test 2 (Academic + Infrastructure) Assignee: ${t2.assigned_to_name} (${t2.assigned_role})`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
