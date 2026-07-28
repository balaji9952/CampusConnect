const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const exportDir = path.join(__dirname, '..', 'data_export');

async function importData() {
  console.log('Starting data import into MySQL...');
  
  if (!fs.existsSync(exportDir)) {
    console.error('Export directory not found!');
    process.exit(1);
  }

  // We need to import tables in the correct order to respect foreign key constraints.
  // We'll sort them. In Prisma, we can just do a naive approach and if a foreign key fails, we can defer it,
  // or we can just specify a rough order based on the schema dependencies.
  
  const tablesOrder = [
    'users',
    'departments',
    'location_categories',
    'routing_groups',
    'locations',
    'academic_QR_sublocations',
    'qr_codes',
    'complaint_categories',
    'tickets',
    'audit_logs',
    'escalation_history',
    'notifications',
    'ticket_updates',
    'ticket_assignments',
    'user_fcm_tokens',
    'user_notification_preferences',
    'global_assignments',
    'escalation_assignments',
    'idempotency_keys',
    'system_settings',
    'user_sessions',
    'qr_verification_sessions',
    'designations',
    'qR_MASTER',
  ];

  // Also catch any tables we missed in the manual sort
  const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));
  const allTables = files.map(f => f.replace('.json', ''));
  
  for (const t of allTables) {
    if (!tablesOrder.includes(t)) tablesOrder.push(t);
  }

  // Disable FK checks in Prisma if possible, but since we are using createMany it might be tricky.
  // Best to just insert in order.
  try {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
  } catch (e) {
    console.log('Could not disable foreign key checks, relying on insert order...');
  }

  for (const model of tablesOrder) {
    const filePath = path.join(exportDir, `${model}.json`);
    if (!fs.existsSync(filePath)) continue;

    console.log(`Importing ${model}...`);
    try {
      const dataStr = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(dataStr);
      
      if (data.length === 0) {
        console.log(`No records to import for ${model}`);
        continue;
      }
      
      // Convert stringified dates/bigints back for createMany
      // Unfortunately createMany doesn't easily convert ISO strings to Date if types don't match, 
      // but Prisma usually handles ISO string -> DateTime automatically.
      
      await prisma[model].createMany({
        data: data,
        skipDuplicates: true // Helpful in case of re-runs
      });
      console.log(`Successfully imported ${data.length} records into ${model}`);
    } catch (error) {
      console.error(`Error importing ${model}:`, error.message);
      
      // Fallback: one by one insertion for better error visibility
      console.log(`Trying one by one for ${model}...`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      let success = 0;
      for (const row of data) {
         try {
            await prisma[model].create({ data: row });
            success++;
         } catch(e) {
            console.error(`Failed on row in ${model}:`, e.message);
         }
      }
      console.log(`Imported ${success}/${data.length} manually for ${model}`);
    }
  }

  try {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
  } catch(e) {}

  console.log('Data import completed!');
}

importData()
  .catch(e => {
    console.error('Fatal error during import:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
