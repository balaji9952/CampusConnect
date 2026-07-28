import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, { id: number, name: string, type: 'DEPARTMENT' | 'GLOBAL' }> = {
  'Academic': { id: 1, name: 'Academic', type: 'DEPARTMENT' },
  'Toilet': { id: 2, name: 'Washroom', type: 'GLOBAL' },
  'Laboratory': { id: 3, name: 'Laboratory', type: 'DEPARTMENT' },
  'Hostel': { id: 4, name: 'Girls Hostel', type: 'GLOBAL' },
  'Mess': { id: 5, name: 'Girls Mess', type: 'GLOBAL' }, 
  'Transport': { id: 7, name: 'Transport', type: 'GLOBAL' },
  'Main gate': { id: 8, name: 'Main Gate', type: 'GLOBAL' },
  'Sports': { id: 9, name: 'Sports', type: 'GLOBAL' },
  'Library': { id: 10, name: 'Library', type: 'GLOBAL' },
  'Laundry': { id: 11, name: 'Laundry', type: 'GLOBAL' },
  'Power Room': { id: 12, name: 'Power Room', type: 'GLOBAL' },
  'Kitchen': { id: 13, name: 'Kitchen', type: 'GLOBAL' },
  'Canteen': { id: 14, name: 'Canteen', type: 'GLOBAL' },
  'General': { id: 15, name: 'General', type: 'DEPARTMENT' },
};

const EXTRA_CATEGORIES = [
  { id: 6, name: 'Boys Mess', type: 'GLOBAL' as const },
  { id: 16, name: 'Boys Hostel', type: 'GLOBAL' as const }
];

const PREDEFINED_ROUTING_GROUPS = [
  { id: 1, key: 'HOSTEL', display: 'Hostel' },
  { id: 2, key: 'MESS', display: 'Mess' },
  { id: 3, key: 'TRANSPORT', display: 'Transport' },
  { id: 4, key: 'SECURITY', display: 'Security' },
  { id: 5, key: 'SPORTS', display: 'Sports' },
  { id: 6, key: 'LIBRARY', display: 'Library' },
  { id: 7, key: 'LAUNDRY', display: 'Laundry' },
  { id: 8, key: 'ELECTRICAL', display: 'Electrical' },
  { id: 9, key: 'KITCHEN', display: 'Kitchen' },
  { id: 10, key: 'CANTEEN', display: 'Canteen' },
  { id: 11, key: 'WASHROOM', display: 'Washroom' }
];

const ROUTING_GROUP_MAP: Record<string, string> = {
  'LIBRARY_HEAD': 'LIBRARY',
  'SANITATION_HEAD': 'WASHROOM',
  'CANTEEN_HEAD': 'CANTEEN',
  'BOYS_MESS_MANAGER': 'MESS',
  'GIRLS_MESS_MANAGER': 'MESS',
  'PARENT_FEEDBACK_MANAGER': 'SECURITY',
  'BOYS_HOSTEL_WARDEN': 'HOSTEL',
  'TRANSPORT_MANAGER': 'TRANSPORT'
};

const TO_DELETE_IDS = [15, 17, 20];

async function main() {
  console.log('--- Phase 3 & 4: Data Migration ---\n');

  console.log('1. Seeding Location Categories...');
  for (const key of Object.keys(CATEGORY_MAP)) {
    const cat = CATEGORY_MAP[key];
    await prisma.location_categories.upsert({
      where: { id: cat.id },
      update: { name: cat.name, routing_type: cat.type },
      create: { id: cat.id, name: cat.name, routing_type: cat.type }
    });
  }
  for (const cat of EXTRA_CATEGORIES) {
    await prisma.location_categories.upsert({
      where: { id: cat.id },
      update: { name: cat.name, routing_type: cat.type },
      create: { id: cat.id, name: cat.name, routing_type: cat.type }
    });
  }
  
  console.log('2. Seeding Routing Groups...');
  for (const grp of PREDEFINED_ROUTING_GROUPS) {
    await prisma.routing_groups.upsert({
      where: { id: grp.id },
      update: { key: grp.key, display_name: grp.display },
      create: { id: grp.id, key: grp.key, display_name: grp.display }
    });
  }

  const routingGroupKeyToId = Object.fromEntries(PREDEFINED_ROUTING_GROUPS.map(g => [g.key, g.id]));

  console.log('3. Deleting test locations and their tickets...');
  const ticketsToDelete = await prisma.tickets.findMany({ where: { location_id: { in: TO_DELETE_IDS } }, select: { id: true } });
  const ticketIds = ticketsToDelete.map(t => t.id);
  
  if (ticketIds.length > 0) {
    await prisma.notifications.deleteMany({ where: { ticket_id: { in: ticketIds } } });
    await prisma.ticket_updates.deleteMany({ where: { ticket_id: { in: ticketIds } } });
    await prisma.ticket_assignments.deleteMany({ where: { ticket_id: { in: ticketIds } } });
    await prisma.escalation_history.deleteMany({ where: { ticket_id: { in: ticketIds } } });
    await prisma.tickets.deleteMany({ where: { id: { in: ticketIds } } });
  }

  await prisma.locations.deleteMany({
    where: { id: { in: TO_DELETE_IDS } }
  });

  console.log('4. Migrating Global Assignments...');
  const globalAssignments = await prisma.global_assignments.findMany();
  for (const ga of globalAssignments) {
    const mappedKey = ROUTING_GROUP_MAP[ga.routing_key] || ga.routing_key;
    const groupId = routingGroupKeyToId[mappedKey];
    if (!groupId) throw new Error(`Could not map Global Assignment ${ga.id} key ${ga.routing_key}`);
    
    await prisma.global_assignments.update({
      where: { id: ga.id },
      data: { routing_group_id: groupId }
    });
  }

  console.log('5. Migrating Locations...');
  const locations = await prisma.locations.findMany();
  for (const loc of locations) {
    let catDef = CATEGORY_MAP[loc.category];
    if (loc.category === 'Mess' && loc.name.toLowerCase().includes('boys')) catDef = EXTRA_CATEGORIES[0]; // Boys Mess
    if (loc.category === 'Hostel' && loc.name.toLowerCase().includes('boys')) catDef = EXTRA_CATEGORIES[1]; // Boys Hostel
    if (loc.id === 14) catDef = CATEGORY_MAP['Transport'];
    
    if (!catDef) throw new Error(`Unknown category for location ${loc.id}`);

    let newDept = loc.department_id;
    let mappedKey = loc.routing_key ? (ROUTING_GROUP_MAP[loc.routing_key] || loc.routing_key) : null;
    if (loc.id === 9) mappedKey = 'SPORTS';

    let newGroupId = mappedKey ? routingGroupKeyToId[mappedKey] : null;

    if (catDef.type === 'DEPARTMENT') {
      newGroupId = null;
    } else {
      newDept = null;
    }

    await prisma.locations.update({
      where: { id: loc.id },
      data: {
        category_id: catDef.id,
        department_id: newDept,
        routing_group_id: newGroupId
      }
    });
  }

  console.log('✅ Data migration completed successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
