const http = require('http');

const payload = JSON.stringify({
  name: "Test Student",
  email: "teststudent999@mountzion.ac.in",
  phone: "8903360137",
  password: "password123",
  role: 0,
  isActive: true,
  programType: "UG",
  branch: "B.Tech",
  departmentId: 1,
  studyYear: "2nd Year",
  rollNo: "9954"
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/admin/users',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
    // Note: this will return 401 Unauthorized because we don't have a token, but let's see if we can get a 500 without a token? No, middleware will block it.
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});

req.on('error', console.error);
req.write(payload);
req.end();
