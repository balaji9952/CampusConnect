const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Parent Feedback permanent records...');
  
  // Create or find Location
  let loc = await prisma.locations.findFirst({
    where: { name: 'Parent Feedback' }
  });
  
  if (!loc) {
    loc = await prisma.locations.create({
      data: {
        name: 'Parent Feedback',
        block: 'System',
        routing_type: 'GLOBAL_ROUTED',
        routing_key: 'PARENT_FEEDBACK_MANAGER',
        is_active: true
      }
    });
    console.log('Created Location:', loc.id);
  } else {
    console.log('Location already exists:', loc.id);
  }

  // Create or find Category
  let cat = await prisma.complaint_categories.findFirst({
    where: { name: 'Parent Feedback' }
  });
  
  if (!cat) {
    cat = await prisma.complaint_categories.create({
      data: {
        name: 'Parent Feedback',
        description: 'System category for parent feedback',
        icon: 'message',
        routing_type: 'GLOBAL_ROUTED',
        routing_key: 'PARENT_FEEDBACK_MANAGER',
        sort_order: 99,
        sla_response_hours: 24,
        sla_escalation_hours: 48,
        sla_resolution_hours: 72,
        is_active: true
      }
    });
    console.log('Created Category:', cat.id);
  } else {
    console.log('Category already exists:', cat.id);
  }

  // Ensure 'Office Manager' exists in global assignments
  // For testing, let's see if anyone has 'Office Manager' designation
  const officeManager = await prisma.users.findFirst({
    where: { designation: 'Office Manager' }
  });
  
  if (officeManager) {
    const existingAssignment = await prisma.global_assignments.findFirst({
      where: { routing_key: 'PARENT_FEEDBACK_MANAGER', assigned_user_id: officeManager.id }
    });
    if (!existingAssignment) {
      await prisma.global_assignments.create({
        data: {
          routing_key: 'PARENT_FEEDBACK_MANAGER',
          assigned_user_id: officeManager.id,
          assigned_by: officeManager.id,
          priority: 1
        }
      });
      console.log('Assigned PARENT_FEEDBACK_MANAGER to user:', officeManager.email);
    } else {
      console.log('Global assignment already exists for PARENT_FEEDBACK_MANAGER');
    }
  } else {
    console.log('No Office Manager found in users yet. Skipping global assignment.');
  }

  console.log('Seed complete.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
