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
  [/if \(!routingKey \|\| !userId\) \{/g, 'if (!routingGroupId || !userId) {'],
  [/routing_group_id: routingKey/g, 'routing_group_id: routingGroupId'],
  [/routingKey: \`\$\{routingGroupId\}\`/g, 'routingKey: `${routingGroupId}`'],
  [/routingKey: string,/g, 'routingGroupId: number,'],
  [/routing_group_id: key,/g, 'routing_group_id: parseInt(key, 10),']
]);

// 2. locations.service.ts
replaceInFile('src/services/locations.service.ts', [
  [/routingType: location\.location_categories\?\.routing_type \?\? null,/g, 'routingType: null,'],
  [/routingGroupId: location\.routing_group_id \?\? null,/g, 'routingGroupId: location.routing_group_id ?? null,'],
  [/category: location\.location_categories\?\.name \?\? "Unknown",/g, 'category: "Unknown",']
]);

// 3. qrcodes.service.ts
replaceInFile('src/services/qrcodes.service.ts', [
  [/routing_type: 'DEPARTMENT_ROUTED',/g, 'category_id: 1, // Fallback'],
  [/routing_key: null,/g, 'routing_group_id: null,']
]);

// 4. tickets.service.ts
replaceInFile('src/services/tickets.service.ts', [
  [/if \(!assignedToName\) \{/g, 'let routingFailure = false;\n    if (!assignedToName) {']
]);

console.log('Fixed stragglers');
