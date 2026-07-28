import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Database Backup...');
  
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Backup Locations
  const locations = await prisma.locations.findMany();
  fs.writeFileSync(path.join(backupDir, 'locations_backup.json'), JSON.stringify(locations, null, 2));
  console.log(`Backed up ${locations.length} locations.`);

  // Backup Global Assignments
  const globalAssignments = await prisma.global_assignments.findMany();
  fs.writeFileSync(path.join(backupDir, 'global_assignments_backup.json'), JSON.stringify(globalAssignments, null, 2));
  console.log(`Backed up ${globalAssignments.length} global assignments.`);

  // Backup Tickets
  // Note: stringify BigInt properly
  const tickets = await prisma.tickets.findMany();
  fs.writeFileSync(path.join(backupDir, 'tickets_backup.json'), JSON.stringify(tickets, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2));
  console.log(`Backed up ${tickets.length} tickets.`);

  console.log('Backup complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
