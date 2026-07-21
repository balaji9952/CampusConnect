import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function run() {
  console.log("=== Location Configuration Audit ===");
  const locations = await prisma.locations.findMany({ select: { name: true, routing_type: true, routing_key: true }});
  
  let invalidLocations = 0;
  for (const loc of locations) {
    let expectedType = 'DEPARTMENT_ROUTED';
    let expectedKey = null;

    if (loc.name.includes('Hostel')) { expectedType = 'GLOBAL_ROUTED'; expectedKey = 'HOSTEL_WARDEN'; }
    else if (loc.name.includes('Canteen')) { expectedType = 'GLOBAL_ROUTED'; expectedKey = 'CANTEEN_HEAD'; }
    else if (loc.name.includes('Library')) { expectedType = 'GLOBAL_ROUTED'; expectedKey = 'LIBRARY_HEAD'; }
    else if (loc.name.includes('Transport')) { expectedType = 'GLOBAL_ROUTED'; expectedKey = 'TRANSPORT_MANAGER'; }
    else if (loc.name.includes('Toilet') || loc.name.includes('Restroom')) { expectedType = 'GLOBAL_ROUTED'; expectedKey = 'SANITATION_HEAD'; }
    
    if (loc.routing_type !== expectedType || loc.routing_key !== expectedKey) {
      console.error(`MISMATCH: ${loc.name} -> Expected ${expectedType}/${expectedKey}, got ${loc.routing_type}/${loc.routing_key}`);
      invalidLocations++;
    } else {
      console.log(`OK: ${loc.name} -> ${loc.routing_type} ${loc.routing_key ? '(' + loc.routing_key + ')' : ''}`);
    }
  }

  console.log("\n=== Global Assignments Audit ===");
  const keys = ['HOSTEL_WARDEN', 'CANTEEN_HEAD', 'LIBRARY_HEAD', 'TRANSPORT_MANAGER', 'SANITATION_HEAD'];
  
  for (const key of keys) {
    const activeAssignments = await prisma.global_assignments.findMany({
      where: { routing_key: key, is_active: true }
    });

    if (activeAssignments.length === 0) {
      console.log(`[FIXING] 0 active users for ${key}. Creating dummy staff user and assigning...`);
      const userId = uuidv4();
      const pwd = 'dummy_hash_please_reset';
      
      const readableName = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      
      await prisma.users.create({
        data: {
          id: userId,
          name: `Test ${readableName}`,
          email: `${key.toLowerCase()}@campus.edu`,
          password_hash: pwd,
          role: 1, // Staff
          designation: readableName,
          is_active: true
        }
      });
      
      await prisma.global_assignments.create({
        data: {
          routing_key: key,
          user_id: userId,
          is_active: true
        }
      });
      console.log(`-> Created and assigned user ${userId} to ${key}`);
    } else if (activeAssignments.length > 1) {
      console.error(`[CRITICAL ERROR] More than 1 active user for ${key}: ${activeAssignments.length}`);
    } else {
      console.log(`OK: Exactly 1 active user for ${key} (User ID: ${activeAssignments[0].user_id})`);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
