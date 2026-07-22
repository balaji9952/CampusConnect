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
    const isSysAdmin = await pool.request().query("SELECT IS_SRVROLEMEMBER('sysadmin') as sysadmin");
    console.log('Is SysAdmin:', isSysAdmin.recordset[0].sysadmin);
    
    if (isSysAdmin.recordset[0].sysadmin) {
      console.log('User is sysadmin. Attempting to grant access to CC...');
      await pool.request().query("USE master; ALTER AUTHORIZATION ON DATABASE::CC TO balaji;");
      console.log('Successfully made balaji the owner of CC database!');
    }
  } catch (err) {
    console.error('Query Error:', err.message);
  }
  process.exit(0);
}).catch(err => {
  console.error('Connection Error:', err.message);
  process.exit(1);
});
