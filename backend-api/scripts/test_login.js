const http = require('http');

function api(method, path, body) {
  return new Promise((resolve) => {
    const hasBody = body != null;
    const json = hasBody ? JSON.stringify(body) : null;
    const headers = {
      'Accept': 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(json ? { 'Content-Length': Buffer.byteLength(json) } : {})
    };
    const options = { hostname: '127.0.0.1', port: 3030, path, method, headers };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data.substring(0, 500) }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    if (json) req.write(json);
    req.end();
  });
}

async function main() {
  console.log('Testing login...');
  const res = await api('POST', '/api/auth/login', {
    identifier: 'admin@mountzion.ac.in',
    password: 'Admin@123',
    role: 3
  });
  console.log('Status:', res.status);
  console.log('Body:', JSON.stringify(res.body, null, 2));
}

main().catch(e => console.error(e.message));
