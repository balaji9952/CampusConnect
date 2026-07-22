import * as fs from 'fs';
import * as path from 'path';

function replaceInFile(relativePath: string, replacements: [string | RegExp, string][]) {
  const fullPath = path.join(__dirname, '..', relativePath);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf8');
  for (const [search, replace] of replacements) {
    content = content.replace(search, replace);
  }
  fs.writeFileSync(fullPath, content);
}

// 1. global-assignments.service.ts
replaceInFile('src/services/global-assignments.service.ts', [
  [/description: \`Admin reassigned routing_group_id \$\{routingKey\}/g, 'description: `Admin reassigned routing_group_id ${routingGroupId}']
]);

// 2. locations.service.ts
replaceInFile('src/services/locations.service.ts', [
  [/routingType: null,/g, '']
]);

// 3. qrcodes.service.ts
replaceInFile('src/services/qrcodes.service.ts', [
  [/routing_type: 'DEPARTMENT_ROUTED',/g, 'category_id: 1, // Fallback'],
  [/routing_key: null,/g, 'routing_group_id: null,']
]);

// 4. tickets.service.ts
replaceInFile('src/services/tickets.service.ts', [
  [
`    if (routingFailure) {
      txPromises.push(prisma.audit_logs.create({
        data: {
          user_id: userId,
          user_name: userName,
          action: 'TICKET_ROUTING_FALLBACK',
          entity_type: 'tickets',
          entity_id: ticketId,
          description: assignmentReason,
        },
      }));
    }`,
    ``
  ]
]);

console.log('Fixed final TS errors');
