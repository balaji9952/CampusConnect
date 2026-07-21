const { Client } = require('pg');

const oldDbUrl = 'postgresql://postgres.uaqyrbladtweeimwrqvb:Balaji9952%40mountzion.ac.in@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';
const newDbUrl = 'postgresql://postgres.zywvcurdksjgvlgeehnb:INDIA_DATABASE%403908@3.109.171.244:5432/postgres';

async function migrateData() {
  const oldClient = new Client({ connectionString: oldDbUrl });
  const newClient = new Client({ connectionString: newDbUrl });

  try {
    await oldClient.connect();
    console.log('Connected to OLD DB.');
    
    await newClient.connect();
    console.log('Connected to NEW DB.');

    // Fetch all tables in the public schema
    const tablesRes = await oldClient.query(`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public'
    `);
    const tables = tablesRes.rows.map(r => r.tablename);
    console.log('Tables to migrate:', tables);

    // Disable foreign key checks on the new DB for the session
    await newClient.query("SET session_replication_role = 'replica';");
    
    for (const table of tables) {
      if (table === '_prisma_migrations') continue;
      
      console.log(`Migrating table: ${table}...`);
      
      // Check if table exists in new DB
      const existsRes = await newClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `, [table]);
      
      if (!existsRes.rows[0].exists) {
        console.log(`  - Table ${table} does not exist in new DB, skipping.`);
        continue;
      }
      
      const { rows } = await oldClient.query(`SELECT * FROM "${table}"`);
      
      if (rows.length === 0) {
        console.log(`  - 0 rows, skipping.`);
        continue;
      }
      
      const columns = Object.keys(rows[0]);
      
      // Clear existing data (if any) to prevent duplicates
      await newClient.query(`DELETE FROM "${table}"`);
      
      // Batch insert logic
      const BATCH_SIZE = 100;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        
        let valuesStr = [];
        let queryParams = [];
        let paramIndex = 1;
        
        for (const row of batch) {
          const placeholders = columns.map(() => `$${paramIndex++}`).join(', ');
          valuesStr.push(`(${placeholders})`);
          
          for (const col of columns) {
            queryParams.push(row[col]);
          }
        }
        
        const insertQuery = `
          INSERT INTO "${table}" ("${columns.join('", "')}")
          VALUES ${valuesStr.join(', ')}
        `;
        
        await newClient.query(insertQuery, queryParams);
      }
      
      console.log(`  - Inserted ${rows.length} rows.`);
      
      // Sync sequences for auto-incrementing primary keys (id)
      try {
        const seqRes = await oldClient.query(`
          SELECT column_default 
          FROM information_schema.columns 
          WHERE table_name = '${table}' AND column_default LIKE 'nextval%'
        `);
        if (seqRes.rows.length > 0) {
          const maxIdRes = await newClient.query(`SELECT MAX(id) FROM "${table}"`);
          const maxId = maxIdRes.rows[0].max || 0;
          if (maxId > 0) {
            await newClient.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ${maxId} + 1, false)`);
            console.log(`  - Updated sequence for ${table} to ${maxId + 1}`);
          }
        }
      } catch(e) {
        // Ignore sequence sync errors
      }
    }
    
    // Re-enable foreign key checks
    await newClient.query("SET session_replication_role = 'origin';");
    console.log('\\nMigration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await oldClient.end();
    await newClient.end();
  }
}

migrateData();
