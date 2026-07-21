const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000, // or 5000? Let's check package.json or server
  path: '/api/notifications',
  method: 'GET',
  headers: {
    // I need the HOD's token. 
    // Wait, let's login as HOD.
  }
};
