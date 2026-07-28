import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

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

// Routing keys from existing data -> New Routing Groups
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

const PREDEFINED_ROUTING_GROUPS = [
  'HOSTEL', 'MESS', 'TRANSPORT', 'SECURITY', 'SPORTS', 
  'LIBRARY', 'LAUNDRY', 'ELECTRICAL', 'KITCHEN', 'CANTEEN', 'WASHROOM'
];

// Locations specified by user to be deleted because they are invalid tests
const TO_DELETE_IDS = [15, 17, 20];

async function main() {
  console.log('--- Phase 1: Location Migration Dry-Run Report ---\n');
  const locations = await prisma.locations.findMany();
  
  let hasErrors = false;
  const reportLines: string[] = [];
  reportLines.push('| ID | Location Name | Current Category | New Category | Department | Routing Group | Migration Status |');
  reportLines.push('|----|---------------|------------------|--------------|------------|---------------|------------------|');

  for (const loc of locations) {
    if (TO_DELETE_IDS.includes(loc.id)) {
      reportLines.push(`| ${loc.id} | ${loc.name} | ${loc.category} | DELETED | NULL | NULL | Ready (Will Delete) |`);
      continue;
    }

    let status = 'Ready';
    
    // Map Category
    let catDef = CATEGORY_MAP[loc.category];
    // Specific overrides based on user input and logic
    if (loc.category === 'Mess' && loc.name.toLowerCase().includes('boys')) catDef = { id: 6, name: 'Boys Mess', type: 'GLOBAL' };
    if (loc.category === 'Hostel' && loc.name.toLowerCase().includes('boys')) catDef = { id: 16, name: 'Boys Hostel', type: 'GLOBAL' };
    if (loc.id === 14) catDef = { id: 7, name: 'Transport', type: 'GLOBAL' };

    if (!catDef) {
      status = '⚠ Needs Review (Unknown Category)';
      hasErrors = true;
      reportLines.push(`| ${loc.id} | ${loc.name} | ${loc.category} | UNKNOWN | ${loc.department_id || 'NULL'} | ${loc.routing_key || 'NULL'} | ${status} |`);
      continue;
    }

    let newDept = loc.department_id;
    let newGroup = loc.routing_key ? ROUTING_GROUP_MAP[loc.routing_key] || loc.routing_key : null;

    // Specific mapping for location 9
    if (loc.id === 9) {
      newGroup = 'SPORTS';
    }

    if (catDef.type === 'DEPARTMENT') {
      if (!newDept) {
        status = '⚠ Needs Review (Missing Dept for Dept-Routed)';
        hasErrors = true;
      }
      newGroup = null; // Ensure nullified
    } else if (catDef.type === 'GLOBAL') {
      if (!newGroup) {
        status = '⚠ Needs Review (Missing Routing Key for Global-Routed)';
        hasErrors = true;
      } else if (!PREDEFINED_ROUTING_GROUPS.includes(newGroup)) {
        status = `⚠ Needs Review (Unknown Routing Group: ${newGroup})`;
        hasErrors = true;
      }
      newDept = null; // Ensure nullified
    }

    reportLines.push(`| ${loc.id} | ${loc.name} | ${loc.category} | ${catDef.name} (${catDef.type}) | ${newDept !== null ? newDept : 'NULL'} | ${newGroup || 'NULL'} | ${status} |`);
  }

  const reportString = reportLines.join('\n');
  console.log(reportString);
  fs.writeFileSync('migration_report.md', reportString);

  console.log('\nChecking Global Assignments...');
  const globalAssignments = await prisma.global_assignments.findMany();
  for (const ga of globalAssignments) {
    const newGroup = ROUTING_GROUP_MAP[ga.routing_key] || ga.routing_key;
    if (!PREDEFINED_ROUTING_GROUPS.includes(newGroup)) {
      console.log(`⚠ Global Assignment ID ${ga.id} has unknown routing key "${ga.routing_key}" mapping to "${newGroup}"`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('\n❌ MIGRATION BLOCKED: There are locations or assignments that need manual review before migrating.');
    process.exit(1);
  } else {
    console.log('\n✅ MIGRATION READY: All locations and assignments mapped successfully.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
