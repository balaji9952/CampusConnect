const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    id: 'admin123',
    email: 'admin@example.com',
    name: 'Admin',
    role: 'Admin',
    designation: ''
  },
  'f9k2a4mP3vR8cZ1lX7wQ5tB0jH6nS4yE9uD2gL5xV1bM',
  { expiresIn: '1h', issuer: 'CampusConnect', audience: 'CampusConnectApp' }
);

console.log('Generated token:', token);

async function testApi() {
  try {
    const res = await fetch('http://localhost:5000/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'htrty',
        email: 'newemail1234@mountzion.ac.in',
        phone: '8903360137',
        role: 0,
        isActive: true,
        password: 'password123',
        programType: 'UG',
        branch: 'B.Tech',
        departmentId: null,
        studyYear: '2nd Year',
        rollNo: '9954null'
      })
    });
    
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testApi();
