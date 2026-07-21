const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 'a6af545c-8c52-42c4-a1a7-4de39710fd3a';
  
  const staffUser = await prisma.users.findUnique({
    where: { id: userId },
    select: { department_id: true, designation: true }
  });

  let globalLocationIds = [];
  const activeGlobalAssignments = await prisma.global_assignments.findMany({
    where: { user_id: userId, is_active: true }
  });
  const assignedKeys = activeGlobalAssignments.map(a => a.routing_key);

  if (assignedKeys.length > 0) {
    const globalLocations = await prisma.locations.findMany({
      where: { routing_type: 'GLOBAL_ROUTED', routing_key: { in: assignedKeys } },
      select: { id: true }
    });
    globalLocationIds = globalLocations.map(l => l.id);
  }

  const orConditions = [
    { ticket_assignments: { some: { assigned_to_user_id: userId } } }
  ];

  if (globalLocationIds.length > 0) {
    orConditions.push({ location_id: { in: globalLocationIds } });
  }

  if (staffUser.department_id) {
    orConditions.push({ locations: { department_id: staffUser.department_id } });
  }
  
  // Wait, does the API also include tickets created by the staff?
  // Let's check TicketsService.getAll again. No, it doesn't.
  
  console.log("OR CONDITIONS:", JSON.stringify(orConditions, null, 2));

  const baseWhere = { is_deleted: false, OR: orConditions };

  const tickets = await prisma.tickets.findMany({
    where: baseWhere,
    select: { id: true, title: true, location_id: true, location_name: true, creator_id: true }
  });
  
  console.log("TICKETS FETCHED:", tickets);
}

check().finally(() => prisma.$disconnect());
