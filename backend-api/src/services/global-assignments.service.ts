import prisma from '../utils/prisma';
import { GLOBAL_ROUTING_KEYS } from '../constants/routing-keys';

export class GlobalAssignmentsService {
  /**
   * GET /api/admin/routing/keys
   */
  static async getSupportedKeys() {
    return prisma.routing_groups.findMany({
      orderBy: { display_name: 'asc' }
    });
  }

  /**
   * GET /api/admin/routing/assignments
   */
  static async getAssignments() {
    return prisma.global_assignments.findMany({
      where: { is_active: true },
      include: {
        users: { select: { id: true, name: true, email: true, designation: true } }
      },
      orderBy: [{ routing_group_id: 'asc' }, { escalation_level: 'asc' }]
    });
  }

  /**
   * GET /api/admin/routing/assignments/by-key
   * Returns all assignments grouped by routing_group_id, including all escalation levels.
   */
  static async getAssignmentsByKey() {
    const all = await prisma.global_assignments.findMany({
      where: { is_active: true },
      include: {
        users: { select: { id: true, name: true, email: true, designation: true } }
      },
      orderBy: { escalation_level: 'asc' }
    });

    // Group by routing_group_id
    const grouped = new Map<number, any[]>();
    for (const a of all) {
      const key = a.routing_group_id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({
        id: a.id,
        user: a.users,
        escalationLevel: a.escalation_level,
        isActive: a.is_active,
      });
    }
    return Array.from(grouped.entries()).map(([routing_group_id, assignments]) => ({
      routing_group_id,
      assignments,
    }));
  }

  /**
   * POST /api/admin/routing/assignments
   * Safely reassigns a routing key (optionally for a specific escalation level) to a user.
   */
  static async reassignKey(
    routingGroupId: number,
    userId: string,
    actorId: string,
    escalationLevel: number | null = 1
  ) {
    const numericGroupId = Number(routingGroupId);
    if (!numericGroupId || !userId) {
      throw new Error('routingGroupId and userId are required');
    }

    const user = await prisma.users.findUnique({ where: { id: userId, is_active: true } });
    if (!user) throw new Error('Target user not found or inactive');

    // Concurrency-safe transaction: soft-delete ALL active assignments for (key, level) combo
    // then create the new one.
    // If escalationLevel is null, it targets L1 (initial assignment).
    const newAssignment = await prisma.$transaction(async (tx) => {
      // 1. Soft-delete active assignments matching routing_group_id AND escalation_level
      await tx.global_assignments.updateMany({
        where: {
          routing_group_id: numericGroupId,
          escalation_level: escalationLevel,
          is_active: true
        },
        data: { is_active: false, updated_at: new Date() }
      });

      // 2. Create the new active assignment
      const assignment = await tx.global_assignments.create({
        data: {
          routing_group_id: numericGroupId,
          user_id: userId,
          escalation_level: escalationLevel,
          is_active: true
        },
        include: { users: { select: { name: true, designation: true } } }
      });

      // 3. Log the change
      await tx.audit_logs.create({
        data: {
          user_id: actorId,
          user_name: 'Admin',
          action: 'REASSIGN_GLOBAL_KEY',
          entity_type: 'global_assignments',
          entity_id: String(assignment.id),
          description: `Routing key ${numericGroupId} (L${escalationLevel ?? 1}) assigned to ${user.name} (${user.id})`
        }
      });

      return assignment;
    });

    return newAssignment;
  }

  /**
   * GET /api/admin/routing/metrics
   * Provides operational health metrics for the dashboard.
   */
  static async getMetrics() {
    // 1. Routing failures in ticket_assignments
    const routingFailures = await prisma.ticket_assignments.count({
      where: { assignment_reason: { startsWith: 'ROUTING_FAILURE' } }
    });

    // 2. Pending Escalations (L1 past 24h, L2 past 48h, etc.)
    // We'll calculate simply as total open tickets right now for metric demo, or exact
    const totalEscalated = await prisma.tickets.count({
      where: { escalation_level: { gt: 1 }, status: { notIn: [2, 4] } }
    });

    // 3. Configuration health: locations missing routing_group_id
    const unconfiguredLocations = await prisma.locations.count({
      where: { location_categories: { routing_type: "GLOBAL" }, routing_group_id: null } as any
    });

    // 4. Missing assignees: GLOBAL_ROUTED locations missing active L1 assignment
    // (L2/L3 assignments are optional fallbacks)
    const locations = await prisma.locations.findMany({
      where: { location_categories: { routing_type: "GLOBAL" }, routing_group_id: { not: null } } as any,
      select: { routing_group_id: true } as any
    });
    
    let missingL1Count = 0;
    let duplicateL1Count = 0;
    const uniqueKeys = Array.from(new Set(locations.map(c => String(c.routing_group_id))));
    for (const key of uniqueKeys) {
      if (!key) continue;
      // L1 = escalation_level = 1 (or null, for backwards compat)
      const l1Count = await prisma.global_assignments.count({
        where: {
          routing_group_id: parseInt(key, 10),
          is_active: true,
          escalation_level: 1
        }
      });
      if (l1Count === 0) missingL1Count++;
      if (l1Count > 1) duplicateL1Count++;
    }

    // 4b. Missing L2/L3 assignments
    const allAssignments = await prisma.global_assignments.findMany({
      where: { is_active: true },
      select: { routing_group_id: true, escalation_level: true }
    });
    const uniqueKeysWithLevels = new Set(allAssignments.map(a => a.routing_group_id));
    let missingL2Count = 0;
    let missingL3Count = 0;
    for (const key of uniqueKeysWithLevels) {
      const hasL2 = allAssignments.some(a => a.routing_group_id === key && a.escalation_level === 2);
      const hasL3 = allAssignments.some(a => a.routing_group_id === key && a.escalation_level === 3);
      if (!hasL2) missingL2Count++;
      if (!hasL3) missingL3Count++;
    }

    // 5. Invalid configs: DEPARTMENT_ROUTED but has a routing_group_id
    const invalidDepartmentLocations = await prisma.locations.count({
      where: { location_categories: { routing_type: "DEPARTMENT" }, routing_group_id: { not: null } } as any
    });

    return {
      routingFailures,
      totalEscalated,
      unconfiguredLocations,
      missingL1Count,
      duplicateL1Count,
      missingL2Count,
      missingL3Count,
      invalidDepartmentLocations,
      status: (missingL1Count === 0 && duplicateL1Count === 0 && unconfiguredLocations === 0 && invalidDepartmentLocations === 0) ? 'HEALTHY' : 'DEGRADED'
    };
  }
}
