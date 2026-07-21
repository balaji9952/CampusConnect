const sql = require('mssql');

const config = {
  user: 'balaji',
  password: 'Appu@0227',
  server: '10.251.176.80', 
  database: 'master', // test with master
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

sql.connect(config).then(() => {
  console.log('Connected to master DB successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Master DB Error:', err.message);
  process.exit(1);
});
