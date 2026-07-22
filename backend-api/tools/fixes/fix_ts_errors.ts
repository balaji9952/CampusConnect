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
  [/routing_key/g, 'routing_group_id'],
  [/routing_type: 'GLOBAL_ROUTED'/g, 'location_categories: { routing_type: "GLOBAL" }'],
  [/routing_type: 'DEPARTMENT_ROUTED'/g, 'location_categories: { routing_type: "DEPARTMENT" }'],
  [
    `const uniqueKeys = Array.from(new Set(locations.map(c => c.routing_group_id)));`,
    `const uniqueKeys = Array.from(new Set(locations.map(c => String(c.routing_group_id))));`
  ]
]);

// 2. locations.service.ts (leftover)
replaceInFile('src/services/locations.service.ts', [
  [/routingType: location\.routing_type,/g, 'routingType: location.location_categories?.routing_type ?? null,'],
  [/routingKey: location\.routing_key,/g, 'routingGroupId: location.routing_group_id ?? null,'],
  [/category: location\.category,/g, 'category: location.location_categories?.name ?? "Unknown",']
]);

// 3. tickets.service.ts (leftover routingFailure)
replaceInFile('src/services/tickets.service.ts', [
  [/if \(routingFailure \|\| !assignedToName\) \{/g, 'if (!assignedToName) {']
]);

// 4. validate-routing.ts
replaceInFile('src/utils/validate-routing.ts', [
  [/routing_key/g, 'routing_group_id']
]);

// 5. seed_locations_v2.ts
replaceInFile('src/seed_locations_v2.ts', [
  [/routing_type: loc.routingType \?\? 'DEPARTMENT_ROUTED',/g, 'category_id: 1, // Fallback'],
  [/routing_key:  loc.routingKey \?\? null,/g, 'routing_group_id: null,']
]);

// 6. qrcodes.service.ts
replaceInFile('src/services/qrcodes.service.ts', [
  [/routing_type: 'DEPARTMENT_ROUTED',/g, 'category_id: 1,'],
  [/routing_key: null,/g, 'routing_group_id: null,']
]);

console.log('Fixed additional TS errors');
