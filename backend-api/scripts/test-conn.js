const sql = require('mssql');

const config = {
  user: 'balaji',
  password: 'Appu@0227',
  server: '10.251.176.80', 
  database: 'CC',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

sql.connect(config).then(() => {
  console.log('Connected to MSSQL directly!');
  process.exit(0);
}).catch(err => {
  console.error('MSSQL Connection Error:', err.message);
  process.exit(1);
});
