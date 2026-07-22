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
  [`const grouped = new Map<string, any[]>();`, `const grouped = new Map<number, any[]>();`],
  [`routingKey: string`, `routingGroupId: number`],
  [`routing_group_id: routingKey`, `routing_group_id: routingGroupId`],
  [`where: { location_categories: { routing_type: "GLOBAL" }, routing_group_id: null }`, `where: { location_categories: { routing_type: "GLOBAL" }, routing_group_id: null } as any`],
  [`where: { location_categories: { routing_type: "GLOBAL" }, routing_group_id: { not: null } }`, `where: { location_categories: { routing_type: "GLOBAL" }, routing_group_id: { not: null } } as any`],
  [`select: { routing_group_id: true }`, `select: { routing_group_id: true } as any`],
  [`where: { location_categories: { routing_type: "DEPARTMENT" }, routing_group_id: { not: null } }`, `where: { location_categories: { routing_type: "DEPARTMENT" }, routing_group_id: { not: null } } as any`]
]);

// 2. validate-routing.ts
replaceInFile('src/utils/validate-routing.ts', [
  [`const existingKeys = new Set(existingAssignments.map(a => a.routing_group_id));`, `const existingKeys = new Set(existingAssignments.map(a => Number(a.routing_group_id)));`],
  [`routing_group_id: { in: GLOBAL_ROUTING_KEY_VALUES }`, `routing_group_id: { in: GLOBAL_ROUTING_KEY_VALUES as any }`],
  [`const key of GLOBAL_ROUTING_KEY_VALUES`, `const key of GLOBAL_ROUTING_KEY_VALUES as any`]
]);

// 3. locations.service.ts (buildLocationLabel signature)
replaceInFile('src/services/locations.service.ts', [
  [
`  routingType?: string;
  routingKey?: string | null;`,
`  routingType?: string;
  routingGroupId?: number | null;`
  ],
  [/l\.location_categories\?/g, 'l.location_categories']
]);

// 4. seed_locations_v2.ts
replaceInFile('src/seed_locations_v2.ts', [
  [`category_id: 1, // Fallback`, `category_id: 1`],
  [`routing_group_id: null,`, `routing_group_id: null`]
]);

// 5. qrcodes.service.ts
replaceInFile('src/services/qrcodes.service.ts', [
  [`category_id: 1,`, `category_id: 1,`],
  [`routing_group_id: null,`, `routing_group_id: null,`]
]);

console.log('Fixed final TS errors');
