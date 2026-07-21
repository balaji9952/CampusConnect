import prisma from '../utils/prisma';

export class EscalationAssignmentsService {
  /**
   * GET /api/admin/escalation-assignments
   * Returns all department escalation assignments.
   */
  static async getAll() {
    return prisma.escalation_assignments.findMany({
      where: { is_active: true },
      include: {
        users: { select: { id: true, name: true, designation: true } },
        departments: { select: { id: true, name: true, code: true } },
      },
      orderBy: { department_id: 'asc' },
    });
  }

  /**
   * PUT /api/admin/escalation-assignments
   * Upserts a department escalation assignment.
   */
  static async upsert(
    departmentId: number,
    escalationLevel: 2 | 3,
    userId: string,
    actorId: string
  ) {
    if (!userId) throw new Error('userId is required');
    const user = await prisma.users.findUnique({ where: { id: userId, is_active: true } });
    if (!user) throw new Error('Target user not found or inactive');

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.escalation_assignments.findUnique({
        where: { department_id_escalation_level: { department_id: departmentId, escalation_level: escalationLevel } },
      });

      const assignment = existing
        ? await tx.escalation_assignments.update({
            where: { department_id_escalation_level: { department_id: departmentId, escalation_level: escalationLevel } },
            data: { user_id: userId, is_active: true },
            include: {
              users: { select: { name: true, designation: true } },
              departments: { select: { name: true } },
            },
          })
        : await tx.escalation_assignments.create({
            data: { department_id: departmentId, escalation_level: escalationLevel, user_id: userId, is_active: true },
            include: {
              users: { select: { name: true, designation: true } },
              departments: { select: { name: true } },
            },
          });

      await tx.audit_logs.create({
        data: {
          user_id: actorId,
          user_name: 'Admin',
          action: 'ASSIGN_ESCALATION',
          entity_type: 'escalation_assignments',
          entity_id: String(assignment.id),
          description: `Dept ${departmentId} L${escalationLevel} assigned to ${user.name} (${user.id})`,
        },
      });

      return assignment;
    });

    return result;
  }

  /**
   * DELETE /api/admin/escalation-assignments/:deptId/:level
   */
  static async remove(departmentId: number, escalationLevel: 2 | 3) {
    await prisma.escalation_assignments.deleteMany({
      where: { department_id: departmentId, escalation_level: escalationLevel },
    });
  }
}
