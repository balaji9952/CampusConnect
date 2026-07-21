import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function stripDomain(url: string | null): string | null {
  if (!url) return null;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return url;

  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch (e) {
    return null; // Malformed URL
  }
}

async function migrate() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = args.includes('--dry-run') || !isApply;

  console.log(`--- RUNNING MIGRATION: ${isApply ? 'APPLY' : 'DRY RUN'} ---`);

  const tickets = await prisma.tickets.findMany({ where: { photo_url: { not: null } } });
  const users = await prisma.users.findMany({ where: { avatar_url: { not: null } } });

  let ticketsScanned = tickets.length;
  let usersScanned = users.length;
  let alreadyRelative = 0;
  let requiresMigration = 0;
  let malformedUrls = 0;
  
  let rowsModified = 0;
  let rowsFailed = 0;
  let rowsSkipped = 0;

  console.log(`\nScanning ${ticketsScanned} tickets...`);
  for (const t of tickets) {
    const original = t.photo_url;
    if (original && (original.startsWith('http://') || original.startsWith('https://'))) {
      const stripped = stripDomain(original);
      if (!stripped) {
        malformedUrls++;
        rowsFailed++;
      } else {
        requiresMigration++;
        if (isDryRun) {
          console.log(`[TICKET] ${t.id}: ${original} -> ${stripped}`);
        } else {
          try {
            await prisma.tickets.update({ where: { id: t.id }, data: { photo_url: stripped } });
            rowsModified++;
            console.log(`[TICKET] Migrated ${t.id}`);
          } catch (e) {
            rowsFailed++;
            console.error(`[TICKET] Failed ${t.id}`, e);
          }
        }
      }
    } else {
      alreadyRelative++;
      rowsSkipped++;
    }
  }

  console.log(`\nScanning ${usersScanned} users...`);
  for (const u of users) {
    const original = u.avatar_url;
    if (original && (original.startsWith('http://') || original.startsWith('https://'))) {
      const stripped = stripDomain(original);
      if (!stripped) {
        malformedUrls++;
        rowsFailed++;
      } else {
        requiresMigration++;
        if (isDryRun) {
          console.log(`[USER] ${u.id}: ${original} -> ${stripped}`);
        } else {
          try {
            await prisma.users.update({ where: { id: u.id }, data: { avatar_url: stripped } });
            rowsModified++;
            console.log(`[USER] Migrated ${u.id}`);
          } catch (e) {
            rowsFailed++;
            console.error(`[USER] Failed ${u.id}`, e);
          }
        }
      }
    } else {
      alreadyRelative++;
      rowsSkipped++;
    }
  }

  console.log('\n--- MIGRATION REPORT ---');
  console.log(`Tickets scanned: ${ticketsScanned}`);
  console.log(`Users scanned:   ${usersScanned}`);
  console.log(`Already relative: ${alreadyRelative}`);
  console.log(`Requires migration: ${requiresMigration}`);
  console.log(`Malformed URLs:  ${malformedUrls}`);
  
  if (isApply) {
    console.log(`Rows modified: ${rowsModified}`);
    console.log(`Rows skipped:  ${rowsSkipped}`);
    console.log(`Rows failed:   ${rowsFailed}`);
  }

  await prisma.$disconnect();
}

migrate().catch(console.error);
