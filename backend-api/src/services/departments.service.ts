import prisma from '../utils/prisma';

// ─── DTO ──────────────────────────────────────────────────────────────────────
// Maps a raw Prisma departments record (with includes) into the frontend DTO.
// studentCount and staffCount are injected from separate count queries.
function mapDeptToDto(
  d: any,
  studentCount: number,
  staffCount: number,
) {
  return {
    id: d.id,
    name: d.name,
    code: d.code ?? null,
    hodUserId: d.hod_user_id ?? null,
    hodName: d.users_departments_hod_user_idTousers?.name ?? null,
    hodEmail: d.users_departments_hod_user_idTousers?.email ?? null,
    isActive: d.is_active,
    studentCount,
    staffCount,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

// ─── Shared include for HOD resolution ───────────────────────────────────────
const HOD_INCLUDE = {
  users_departments_hod_user_idTousers: {
    select: { id: true, name: true, email: true },
  },
} as const;

// ─── Dynamic count helper ─────────────────────────────────────────────────────
// Returns { studentCount, staffCount } for a given department id.
// Uses Prisma's relation count with a where filter — no extra columns needed.
async function getDeptCounts(deptId: number): Promise<{ studentCount: number; staffCount: number }> {
  const [studentCount, staffCount] = await Promise.all([
    prisma.users.count({
      where: { department_id: deptId, role: 0, is_active: true },  // role 0 = Student
    }),
    prisma.users.count({
      where: { department_id: deptId, role: 1, is_active: true },  // role 1 = Staff
    }),
  ]);
  return { studentCount, staffCount };
}

// ─── Bulk count helper for list endpoint ─────────────────────────────────────
// Fetches student/staff counts for multiple departments in 2 queries total,
// avoiding N+1 by grouping counts from the users table.
async function getBulkCounts(deptIds: number[]): Promise<Map<number, { studentCount: number; staffCount: number }>> {
  if (deptIds.length === 0) return new Map();

  // Prisma doesn't support GROUP BY natively — use $queryRaw for efficiency
  // But we keep it simple with parallel count calls since dept count is small (<50)
  const countsMap = new Map<number, { studentCount: number; staffCount: number }>();

  // Initialize all to zero
  deptIds.forEach(id => countsMap.set(id, { studentCount: 0, staffCount: 0 }));

  // Fetch all relevant users in one query then aggregate in JS
  const allUsers = await prisma.users.findMany({
    where: {
      department_id: { in: deptIds },
      is_active: true,
      role: { in: [0, 1] },  // Students and Staff only
    },
    select: { department_id: true, role: true },
  });

  for (const u of allUsers) {
    if (u.department_id == null) continue;
    const entry = countsMap.get(u.department_id);
    if (!entry) continue;
    if (u.role === 0) entry.studentCount++;
    if (u.role === 1) entry.staffCount++;
  }

  return countsMap;
}

// ─── Query interface ──────────────────────────────────────────────────────────
export interface ListDeptsQuery {
  search?: string;
  status?: string;   // 'active' | 'inactive' | undefined (all)
  page?: string;
  limit?: string;
}

export class DepartmentsService {
  /**
   * GET /api/departments
   * Returns a paginated list of departments with HOD name and dynamic counts.
   * - search: matches department name OR code (case-insensitive)
   * - status: 'active' | 'inactive' | omit for all
   */
  static async listDepartments(query: ListDeptsQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Search by name OR code
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s } },
        { code: { contains: s } },
      ];
    }

    // Status filter
    if (query.status === 'active') where.is_active = true;
    if (query.status === 'inactive') where.is_active = false;

    const [total, depts] = await Promise.all([
      prisma.departments.count({ where }),
      prisma.departments.findMany({
        where,
        include: HOD_INCLUDE,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);

    // Bulk-fetch counts for all returned departments
    const deptIds = depts.map(d => d.id);
    const countsMap = await getBulkCounts(deptIds);

    const data = depts.map(d => {
      const counts = countsMap.get(d.id) ?? { studentCount: 0, staffCount: 0 };
      return mapDeptToDto(d, counts.studentCount, counts.staffCount);
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * GET /api/departments/:id  (single, for detail view)
   */
  static async getDepartmentById(id: number) {
    const dept = await prisma.departments.findUnique({
      where: { id },
      include: HOD_INCLUDE,
    });
    if (!dept) return null;
    const counts = await getDeptCounts(dept.id);
    return mapDeptToDto(dept, counts.studentCount, counts.staffCount);
  }

  /**
   * GET /api/departments/:id/dashboard
   * Phase 1E-B: Returns department dashboard data.
   */
  static async getDepartmentDashboard(departmentId: number) {
    const dept = await prisma.departments.findUnique({ where: { id: departmentId } });
    if (!dept) return null;

    const isAdminDept = dept.code === 'ADMIN';
    const { AssignmentRepository } = require('../repositories/AssignmentRepository');

    // 1. Statistics
    let statsRow: any = {};
    if (isAdminDept) {
      const rawStats = await prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(id) as total_complaints,
          SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as open_complaints,
          SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as in_progress_complaints,
          SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as resolved_complaints,
          SUM(CASE WHEN escalation_level > 1 AND status NOT IN (2, 4) THEN 1 ELSE 0 END) as escalated_complaints
        FROM tickets
        WHERE is_deleted = false
      `;
      statsRow = rawStats[0] || {};
    } else {
      statsRow = await AssignmentRepository.getDashboardStatistics(departmentId, dept.hod_user_id);
    }

    const statistics = {
      totalComplaints: Number(statsRow.total_complaints || 0),
      openComplaints: Number(statsRow.open_complaints || 0),
      inProgressComplaints: Number(statsRow.in_progress_complaints || 0),
      resolvedComplaints: Number(statsRow.resolved_complaints || 0),
      escalatedComplaints: Number(statsRow.escalated_complaints || 0),
    };

    // 2. Staff Workload
    const staffWhere: any = { role: 1, is_active: true };
    if (!isAdminDept) {
      if (dept.hod_user_id) {
        staffWhere.OR = [
          { department_id: departmentId },
          { id: dept.hod_user_id }
        ];
      } else {
        staffWhere.department_id = departmentId;
      }
    }

    const staff = await prisma.users.findMany({
      where: staffWhere,
      select: { name: true, id: true }
    });

    let workloadData: any[] = [];
    if (isAdminDept) {
      workloadData = (await prisma.tickets.groupBy({
        by: ['assigned_to_name'],
        where: {
          is_deleted: false,
          status: { in: [0, 1] },
          assigned_to_name: { not: null }
        },
        _count: { id: true }
      } as any)) as any[];
    } else {
      workloadData = await AssignmentRepository.getDashboardOwnership(departmentId, dept.hod_user_id);
    }

    // TODO: TECHNICAL DEBT - Workload calculation depends on assigned_to_name string matching.
    // Acceptable for Phase 1E-B but should be replaced with assigned_to_id -> users.id in future.
    const workloadMap = new Map<string, number>();
    for (const w of workloadData) {
      const name = w.assigned_to_name || w.assignee_name;
      if (name) {
        // Handle both Prisma grouped output (_count) and raw SQL output (count)
        workloadMap.set(name, Number(w.count || w._count?.id || 0));
      }
    }

    const staffWorkload = staff.map(s => ({
      id: s.id,
      name: s.name,
      department: isAdminDept ? 'All Departments' : dept.name,
      activeTicketCount: workloadMap.get(s.name) || 0
    }));

    // 3. Recent Complaints
    let recentComplaintsData: any[] = [];
    if (isAdminDept) {
      recentComplaintsData = await prisma.tickets.findMany({
        where: { is_deleted: false },
        orderBy: { created_at: 'desc' },
        take: 100,
        select: {
          ticket_number: true,
          title: true,
          status: true,
          assigned_to_name: true,
          created_at: true
        }
      });
    } else {
      // Use AssignmentRepository to find visible ticket IDs for this department
      const visibleTicketIds = await AssignmentRepository.getDepartmentOwnedTickets(departmentId);
      if (dept.hod_user_id) {
         // Include tickets explicitly assigned to HOD (since HOD belongs to the department dashboard view)
         // Wait, getDepartmentOwnedTickets already handles the department, but if HOD is in another department
         // we might need to add it, but normally HOD is in the same department.
         // Let's just use raw SQL to fetch recent ones directly for the department.
      }
      
      recentComplaintsData = await prisma.$queryRaw<any[]>`
        SELECT t.ticket_number, t.title, t.status, a.assignee_name as assigned_to_name, t.created_at
        FROM tickets t
        JOIN (
          SELECT ta.ticket_id, u.department_id, u.id as user_id, u.name as assignee_name, ROW_NUMBER() OVER(PARTITION BY ta.ticket_id ORDER BY ta.assigned_at DESC) as rn
          FROM ticket_assignments ta
          LEFT JOIN users u ON ta.assigned_to_user_id = u.id
        ) as a ON t.id = a.ticket_id
        WHERE t.is_deleted = false AND a.rn = 1 AND (a.department_id = ${departmentId} OR a.user_id = ${dept.hod_user_id || 'NONE'})
        ORDER BY t.created_at DESC
        LIMIT 100 OFFSET 0
      `;
    }

    const recentComplaints = recentComplaintsData.map(t => ({
      ticketNumber: t.ticket_number,
      title: t.title,
      status: t.status,
      assignedTo: t.assigned_to_name || 'Unassigned',
      createdAt: t.created_at
    }));

    return {
      department: dept.name,
      statistics,
      staffWorkload,
      recentComplaints
    };
  }

  /**
   * POST /api/departments
   * Validates:
   *   - name must be unique (DB constraint exists)
   *   - code must be unique (enforced at application level — no DB constraint)
   *   - hodUserId must exist in users table if provided
   */
  static async createDepartment(data: {
    name: string;
    code?: string;
    hodUserId?: string | null;
    isActive?: boolean;
  }) {
    const name = data.name.trim();
    const code = data.code?.trim().toUpperCase() || null;

    // Name uniqueness (DB also enforces this, but we return a friendly error)
    const nameConflict = await prisma.departments.findFirst({ where: { name } });
    if (nameConflict) throw new Error('DEPT_NAME_EXISTS');

    // Code uniqueness — application-level guard (no DB unique constraint on code)
    if (code) {
      const codeConflict = await prisma.departments.findFirst({ where: { code } });
      if (codeConflict) throw new Error('DEPT_CODE_EXISTS');
    }

    // HOD must be a valid, active user if provided
    if (data.hodUserId) {
      const hod = await prisma.users.findUnique({
        where: { id: data.hodUserId },
        select: { id: true, is_active: true },
      });
      if (!hod) throw new Error('HOD_NOT_FOUND');
      if (!hod.is_active) throw new Error('HOD_INACTIVE');
    }

    const dept = await prisma.departments.create({
      data: {
        name,
        code: code,
        hod_user_id: data.hodUserId ?? null,
        is_active: data.isActive !== false,  // default true
      },
      include: HOD_INCLUDE,
    });

    // Counts will be 0 for a brand-new department
    return mapDeptToDto(dept, 0, 0);
  }

  /**
   * PUT /api/departments/:id
   * Supports partial updates. HOD can be changed or cleared (null).
   */
  static async updateDepartment(
    id: number,
    data: {
      name?: string;
      code?: string | null;
      hodUserId?: string | null;
      isActive?: boolean;
    },
    actorName: string,
  ) {
    // Confirm department exists
    const existing = await prisma.departments.findUnique({ where: { id } });
    if (!existing) return null;

    // Name conflict (exclude self)
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      const conflict = await prisma.departments.findFirst({
        where: { name: trimmed, id: { not: id } },
      });
      if (conflict) throw new Error('DEPT_NAME_EXISTS');
      data.name = trimmed;
    }

    // Code conflict (exclude self, application-level)
    if (data.code !== undefined && data.code !== null) {
      const codeUpper = data.code.trim().toUpperCase();
      const conflict = await prisma.departments.findFirst({
        where: { code: codeUpper, id: { not: id } },
      });
      if (conflict) throw new Error('DEPT_CODE_EXISTS');
      data.code = codeUpper;
    }

    // HOD validation (only if changing)
    if (data.hodUserId !== undefined && data.hodUserId !== null) {
      const hod = await prisma.users.findUnique({
        where: { id: data.hodUserId },
        select: { id: true, is_active: true },
      });
      if (!hod) throw new Error('HOD_NOT_FOUND');
      if (!hod.is_active) throw new Error('HOD_INACTIVE');
    }

    const payload: any = { updated_at: new Date() };
    if (data.name !== undefined) payload.name = data.name;
    if (data.code !== undefined) payload.code = data.code;      // null clears code
    if (data.hodUserId !== undefined) payload.hod_user_id = data.hodUserId; // null clears HOD
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    const updated = await prisma.departments.update({
      where: { id },
      data: payload,
      include: HOD_INCLUDE,
    });

    // Audit log
    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'UPDATE_DEPARTMENT',
        entity_type: 'department',
        entity_id: String(id),
        description: `Admin updated department: ${updated.name}`,
      },
    });

    const counts = await getDeptCounts(id);
    return mapDeptToDto(updated, counts.studentCount, counts.staffCount);
  }

  /**
   * DELETE /api/departments/:id  — soft delete only
   * Sets is_active = false. Never hard-deletes (users + locations reference this table).
   */
  static async deleteDepartment(id: number, actorName: string) {
    const existing = await prisma.departments.findUnique({ where: { id } });
    if (!existing) return false;

    await prisma.departments.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
    });

    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'DELETE_DEPARTMENT',
        entity_type: 'department',
        entity_id: String(id),
        description: `Admin deactivated department: ${existing.name}`,
      },
    });

    return true;
  }

  /**
   * GET /api/departments/:id/staff/:staffId/complaints
   */
  static async getActiveStaffComplaints(departmentId: number, staffId: string) {
    const { AssignmentRepository } = require('../repositories/AssignmentRepository');
    
    // Fetch ticket IDs securely mapped to this staff member's latest assignment
    const assignedTicketIds = await AssignmentRepository.getTicketsAssignedToUser(staffId);
    
    if (assignedTicketIds.length === 0) return [];

    const staffTickets = await prisma.tickets.findMany({
      where: {
        id: { in: assignedTicketIds },
        is_deleted: false,
        status: { in: [0, 1] }
      },
      orderBy: { created_at: 'desc' }
    });

    return staffTickets.map((t: any) => ({
      id: t.id,
      ticketNumber: t.ticket_number,
      title: t.title,
      status: t.status,
      assignedToId: staffId,
      createdAt: t.created_at
    }));
  }

  /**
   * POST /api/departments/:id/bulk-transfer
   */
  static async bulkTransferTickets(
    departmentId: number,
    payload: {
      tickets: { ticketId: string; expectedAssignedToId: string }[];
      toStaffId: string;
      reason: string;
    },
    actorId: string,
    actorName: string,
    actorRole: string
  ) {
    const { tickets, toStaffId, reason } = payload;
    const { v4: uuidv4 } = require('uuid');
    const { FCMService } = require('./fcm.service');

    const result = {
      transferred: 0,
      failed: 0,
      results: [] as any[]
    };

    // 1. Destination Staff Validation
    const destStaff = await prisma.users.findUnique({ where: { id: toStaffId } });
    if (!destStaff) throw new Error('DESTINATION_STAFF_NOT_FOUND');
    if (!destStaff.is_active) throw new Error('DESTINATION_STAFF_INACTIVE');

    let isAdminDept = false;
    let dept = null;

    if (departmentId === 0 || isNaN(departmentId)) {
      isAdminDept = true;
    } else {
      dept = await prisma.departments.findUnique({ where: { id: departmentId } });
      if (!dept) throw new Error('DEPARTMENT_NOT_FOUND');
      isAdminDept = dept.code === 'ADMIN';
    }

    if (!isAdminDept && destStaff.department_id !== departmentId) {
      if (dept?.hod_user_id !== toStaffId) {
        throw new Error('DESTINATION_STAFF_CROSS_DEPARTMENT');
      }
    }

    const postTxPushes: Array<() => Promise<void>> = [];

    // 2. Transaction Scope
    await prisma.$transaction(async (tx) => {
      for (const tReq of tickets) {
        const { ticketId, expectedAssignedToId } = tReq;

        const ticket = await tx.tickets.findUnique({
          where: { id: ticketId },
          include: { 
            ticket_assignments: { 
              orderBy: { assigned_at: 'desc' }, 
              take: 1,
              include: { assignee: true } // Relation for assignee
            }, 
            locations: true 
          }
        });

        if (!ticket) {
          result.failed++;
          result.results.push({ ticketId, status: 'failed', reason: 'Ticket not found' });
          continue;
        }

        const currentAssignee = ticket.ticket_assignments[0]?.assignee;
        
        if (!isAdminDept) {
          const belongsToDept = currentAssignee?.department_id === departmentId || dept?.hod_user_id === currentAssignee?.id;
          if (!belongsToDept && ticket.locations?.department_id !== departmentId) {
            result.failed++;
            result.results.push({ ticketId, status: 'failed', reason: 'Ticket does not belong to the selected department' });
            continue;
          }
        }

        const currentAssignedToId = ticket.ticket_assignments[0]?.assigned_to_user_id;
        if (currentAssignedToId !== expectedAssignedToId) {
          result.failed++;
          result.results.push({ ticketId, status: 'failed', reason: 'Ticket assignment changed while transfer was in progress' });
          continue;
        }

        if (currentAssignedToId === toStaffId) {
          result.failed++;
          result.results.push({ ticketId, status: 'failed', reason: 'Destination staff is already the current assignee' });
          continue;
        }

        await tx.tickets.update({
          where: { id: ticketId },
          data: { 
            assigned_to_name: destStaff.name,
            assigned_role: destStaff.designation || 'Staff'
          }
        });

        await tx.ticket_assignments.create({
          data: {
            ticket_id: ticketId,
            assigned_to_user_id: toStaffId,
            assigned_by: actorId,
            assignment_reason: reason || 'Bulk transferred',
            escalation_level: ticket.escalation_level
          }
        });

        await tx.ticket_updates.create({
          data: {
            ticket_id: ticketId,
            message: reason ? `Ticket transferred: ${reason}` : 'Ticket transferred',
            update_type: 'transfer',
            updated_by: actorName,
            user_id: actorId
          }
        });

        await tx.audit_logs.create({
          data: {
            user_id: actorId,
            user_name: actorName,
            user_role: actorRole,
            action: 'TRANSFER_TICKET',
            entity_type: 'tickets',
            entity_id: ticketId,
            description: `Transferred from ${currentAssignedToId || 'Unassigned'} to ${toStaffId}`,
          }
        });

        const notifId = uuidv4();
        await tx.notifications.create({
          data: {
            id: notifId,
            user_id: toStaffId,
            title: 'Ticket Assigned to You',
            body: `Ticket #${ticket.ticket_number} has been assigned to you.`,
            type: 'TICKET_ASSIGNED',
            ticket_id: ticketId,
            privileged_only: true
          }
        });

        result.transferred++;
        result.results.push({ ticketId, status: 'success' });

        postTxPushes.push(() =>
          FCMService.sendPushToUser(
            toStaffId,
            'Ticket Assigned to You',
            `Ticket #${ticket.ticket_number} has been assigned to you.`,
            { ticketId },
            'ticket_assignments'
          ).catch((e: any) => console.error('[FCM] Failed transfer push:', e))
        );
      }
    });

    for (const push of postTxPushes) {
      await push();
    }

    return result;
  }
}
