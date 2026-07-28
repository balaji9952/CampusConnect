const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const exportDir = path.join(__dirname, '..', 'data_export');

async function exportData() {
  console.log('Starting data export from Supabase (PostgreSQL)...');
  
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir);
  }

  // Get all model names from Prisma schema
  const models = Object.keys(prisma).filter(key => 
    !key.startsWith('_') && 
    !['$on', '$connect', '$disconnect', '$use', '$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe', '$transaction', '$extends'].includes(key)
  );

  console.log(`Found ${models.length} models to export.`);

  for (const model of models) {
    try {
      if (typeof prisma[model].findMany !== 'function') continue;

      console.log(`Exporting ${model}...`);
      const data = await prisma[model].findMany();
      
      const filePath = path.join(exportDir, `${model}.json`);
      // Use a custom replacer to handle BigInt
      fs.writeFileSync(filePath, JSON.stringify(data, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
      , 2));
      
      console.log(`Successfully exported ${data.length} records for ${model}`);
    } catch (error) {
      console.error(`Error exporting ${model}:`, error.message);
    }
  }

  console.log('Data export completed! Files saved in backend-api/data_export/');
}

exportData()
  .catch(e => {
    console.error('Fatal error during export:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
