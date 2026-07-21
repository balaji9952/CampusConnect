import prisma from '../utils/prisma';

import { GLOBAL_ROUTING_KEY_VALUES } from '../constants/routing-keys';

/**
 * Validates that all required global routing assignments exist in the database.
 * Called once at startup (non-blocking). Logs warnings and writes audit entries
 * for any missing keys so admins are alerted.
 */
export async function validateRoutingAssignments(): Promise<void> {
  console.log('[STARTUP] Validating routing assignments...');
  const missing: string[] = [];

  // Fetch all active assignments in ONE query
  const existingAssignments = await prisma.global_assignments.findMany({
    where: { 
      routing_key: { in: GLOBAL_ROUTING_KEY_VALUES },
      is_active: true 
    },
    select: { routing_key: true }
  });

  const existingKeys = new Set(existingAssignments.map(a => a.routing_key));
  const auditLogsToCreate: any[] = [];

  // Identify missing keys
  for (const key of GLOBAL_ROUTING_KEY_VALUES) {
    if (!existingKeys.has(key)) {
      missing.push(key);
      console.warn(`\n⚠️  [STARTUP WARNING] Missing routing assignment: "${key}"`);
      console.warn(
        `    Complaints for this location will fall back to Admin routing.\n`
      );

      // Prepare audit entry for batch insert
      auditLogsToCreate.push({
        user_name: 'System',
        action: 'ROUTING_ASSIGNMENT_MISSING',
        entity_type: 'global_assignments',
        entity_id: key,
        description: `No active global_assignment found for routing_key: "${key}". Complaints may not be routed correctly.`,
      });
    }
  }

  // Batch insert all audit logs in ONE query
  if (auditLogsToCreate.length > 0) {
    await prisma.audit_logs.createMany({
      data: auditLogsToCreate
    });
  }

  if (missing.length === 0) {
    console.log('[STARTUP] ✅ All routing assignments validated successfully.');
  } else {
    console.warn(
      `[STARTUP] ⚠️  ${missing.length} routing key(s) missing: ${missing.join(', ')}`
    );
    console.warn(
      `[STARTUP] Go to Admin → Global Assignments to assign staff for these locations.`
    );
  }
}
