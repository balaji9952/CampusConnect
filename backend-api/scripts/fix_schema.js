const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'prisma', 'schema.prisma');
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/@id\(map:\s*"[^"]+"\)/g, '@id');
fs.writeFileSync(file, content);
console.log('Fixed @id constraints in schema.prisma');
