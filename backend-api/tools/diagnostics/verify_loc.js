const http = require('http');

function api(method, path, body, token) {
  return new Promise((resolve) => {
    const hasBody = (body != null);   // covers both null and undefined
    const json    = hasBody ? JSON.stringify(body) : null;
    const headers = {
      'Accept': 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token  ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(json   ? { 'Content-Length': Buffer.byteLength(json) } : {})
    };
    const options = { hostname: '127.0.0.1', port: 3030, path, method, headers };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data.substring(0, 300) }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    if (json) req.write(json);
    req.end();
  });
}

async function main() {
  const login = await api('POST', '/api/auth/login', { identifier: 'admin@mountzion.ac.in', password: 'Admin@123', role: 3 });
  if (!login.body?.token) { console.log('Login FAILED'); return; }
  const token = login.body.token;
  console.log('✓ Logged in as', login.body.user?.name);

  // 1. Category stats
  const cats = await api('GET', '/api/locations/categories', null, token);
  console.log('\n1. GET /api/locations/categories');
  console.log('   Status:', cats.status, '| Body:', JSON.stringify(cats.body).substring(0, 500));

  // 2. List with category=Library filter
  const lib = await api('GET', '/api/locations?limit=5&category=Library', null, token);
  console.log('\n2. GET /api/locations?category=Library');
  console.log('   Status:', lib.status, '| Count:', lib.body.data?.length);
  lib.body.data?.forEach(l => {
    console.log(`   [${l.category}] "${l.name}" | code="${l.internalCode || '-'}" | block="${l.block || '-'}" | floor="${l.floor || '-'}" | qr=${!!l.qr}`);
  });

  // 3. Create a test location with internalCode
  const created = await api('POST', '/api/locations', {
    name: 'Test Library A',
    internalCode: 'LIB-TEST-01',
    block: 'Block C',
    floor: '2nd Floor',
    routingType: 'GLOBAL_ROUTED',
    routingKey: 'LIBRARY_HEAD',
    isActive: true
  }, token);
  console.log('\n3. POST /api/locations (with internalCode)');
  console.log('   Status:', created.status, created.body.success ? 'OK' : 'FAIL');
  console.log('   Full body:', JSON.stringify(created.body).substring(0, 600));
  if (created.body.success) {
    const loc = created.body.data;
    console.log(`   Created: "${loc.name}" | code="${loc.internalCode}" | cat="${loc.category}"`);

    // 4. Update same location - add internalCode
    const upd = await api('PUT', `/api/locations/${loc.id}`, {
      name: 'Test Library A',
      internalCode: 'LIB-TEST-01',
      block: 'Block C',
      floor: '2nd Floor',
      routingType: 'GLOBAL_ROUTED',
      routingKey: 'LIBRARY_HEAD',
      isActive: true
    }, token);
    console.log('\n4. PUT /api/locations/' + loc.id + ' (update internalCode)');
    console.log('   Status:', upd.status, upd.body.success ? 'OK' : 'FAIL');
    console.log('   internalCode:', upd.body.data?.internalCode);

    // 5. Delete test location
    const del = await api('DELETE', `/api/locations/${loc.id}`, null, token);
    console.log('\n5. DELETE /api/locations/' + loc.id);
    console.log('   Status:', del.status, del.body.success ? 'OK' : 'FAIL');
  } else {
    console.log('   ERROR:', JSON.stringify(created.body));
  }

  // 6. Regenerate all QRs
  console.log('\n6. POST /api/locations/regenerate-all');
  const regen = await api('POST', '/api/locations/regenerate-all', {}, token);
  console.log('   Status:', regen.status, JSON.stringify(regen.body));
  if (regen.body.success) {
    const { total, regenerated, errors } = regen.body.data;
    console.log(`   ${regenerated}/${total} QRs regenerated | errors: ${errors.length}`);
    if (errors.length) errors.forEach(e => console.log('     ERROR:', e));
  }

  // 7. Verify new location list includes internalCode
  const final = await api('GET', '/api/locations?limit=3', null, token);
  console.log('\n7. GET /api/locations (final check)');
  final.body.data?.forEach(l => {
    console.log(`   [${l.category}] "${l.name}" | code="${l.internalCode || '-'}" | qr_token=${l.qr?.token?.substring(0,8) || 'none'}...`);
  });

  console.log('\n✅ All checks done');
}

main().catch(e => { console.error(e); process.exit(1); });
