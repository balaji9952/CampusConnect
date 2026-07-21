const sql = require('mssql');

const config = {
  user: 'balaji',
  password: 'Appu@0227',
  server: '10.251.176.80', 
  database: 'master',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

sql.connect(config).then(async pool => {
  try {
    const dbResult = await pool.request().query("SELECT name, state_desc FROM sys.databases WHERE name = 'CC'");
    console.log('DB State:', dbResult.recordset);
    
    const userResult = await pool.request().query("SELECT p.name AS PrincipalName, p.type_desc, p.is_disabled, l.name AS LoginName, db_name() AS DBName FROM sys.server_principals p LEFT JOIN sys.sql_logins l ON p.sid = l.sid WHERE p.name = 'balaji'");
    console.log('Login Info:', userResult.recordset);
    
    // Check if balaji is mapped to CC
    const mappingResult = await pool.request().query("USE CC; SELECT name FROM sys.database_principals WHERE type IN ('S', 'U', 'G')");
    console.log('Users in CC:', mappingResult.recordset);
  } catch (err) {
    console.error('Query Error:', err.message);
  }
  process.exit(0);
}).catch(err => {
  console.error('Connection Error:', err.message);
  process.exit(1);
});
