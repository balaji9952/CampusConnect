import prisma from '../utils/prisma';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { getRoleString } from '../utils/auth';

// ─── DTO mapper ──────────────────────────────────────────────────────────────
function mapUserToDto(u: any) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    roleLabel: getRoleString(u.role),
    isActive: u.is_active,
    departmentId: u.department_id ?? null,
    departmentName: u.departments_users_department_idTodepartments?.name ?? null,
    departmentCode: u.departments_users_department_idTodepartments?.code ?? null,
    rollNo: u.roll_no ?? null,
    programType: u.program_type ?? null,
    branch: u.branch ?? null,
    studyYear: u.study_year ?? null,
    designation: u.designation ?? null,
    globalRoutingKey: u.global_routing_key ?? null,
    avatarUrl: u.avatar_url ?? null,
    lastLoginAt: u.last_login_at ?? null,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

// ─── List filters ─────────────────────────────────────────────────────────────
export interface ListUsersQuery {
  search?: string;
  role?: string;        // '0'|'1'|'2'|'3'|'4'
  status?: string;      // 'active'|'inactive'
  page?: string;
  limit?: string;
}

export class AdminUsersService {
  /**
   * GET /api/admin/users
   * Returns a paginated, filtered list of all users.
   */
  static async listUsers(query: ListUsersQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Search by name OR email (case-insensitive via contains)
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s } },
        { email: { contains: s } },
      ];
    }

    // Role filter — DB stores as integer
    if (query.role !== undefined && query.role !== '' && query.role !== 'All') {
      const roleInt = parseInt(query.role, 10);
      if (!isNaN(roleInt)) where.role = roleInt;
    }

    // Active / inactive filter
    if (query.status === 'active') where.is_active = true;
    if (query.status === 'inactive') where.is_active = false;

    const include = {
      departments_users_department_idTodepartments: {
        select: { name: true, code: true },
      },
    };

    const [total, users] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        include,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      data: users.map(mapUserToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * GET /api/admin/users/stats
   * Returns aggregate counts for the stat cards on the User Management page.
   * Staff count = role 1 (Staff). Active staff derived the same way.
   */
  static async getUserStats() {
    const [total, active, inactive, staff] = await Promise.all([
      prisma.users.count(),
      prisma.users.count({ where: { is_active: true } }),
      prisma.users.count({ where: { is_active: false } }),
      prisma.users.count({ where: { role: 1 } }),   // role 1 = Staff
    ]);

    return { total, active, inactive, staff };
  }

  /**
   * POST /api/admin/users
   * Creates a new user. A temporary password must be supplied.
   * Duplicate email returns null.
   */
  static async createUser(data: {
    name: string;
    email: string;
    password: string;
    role: number;
    departmentId?: number | null;
    rollNo?: string;
    programType?: string;
    branch?: string;
    studyYear?: string;
    designation?: string;
    globalRoutingKey?: string;
    isActive?: boolean;
  }) {
    const email = data.email.trim().toLowerCase();

    // Duplicate check
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) throw new Error('EMAIL_TAKEN');

    // Check duplicate rollNo within the same role
    if (data.rollNo && data.rollNo.trim() !== '') {
      const rollConflict = await prisma.users.findFirst({
        where: { roll_no: data.rollNo.trim(), role: data.role }
      });
      if (rollConflict) throw new Error('ROLL_NO_TAKEN');
    }

    const password_hash = await bcrypt.hash(data.password, 10);
    const userId = uuidv4();

    const user = await prisma.users.create({
      data: {
        id: userId,
        name: data.name.trim(),
        email: email,
        password_hash,
        role: data.role,
        departments_users_department_idTodepartments: data.departmentId ? { connect: { id: data.departmentId } } : undefined,
        roll_no: data.rollNo?.trim() ?? null,
        program_type: data.programType ?? null,
        branch: data.branch ?? null,
        study_year: data.studyYear ?? null,
        designation: data.designation ?? null,
        is_active: data.isActive !== false,   // default true
      },
      include: {
        departments_users_department_idTodepartments: {
          select: { name: true, code: true },
        },
      },
    });

    // Write audit log
    await prisma.audit_logs.create({
      data: {
        user_id: userId,
        user_name: user.name,
        user_role: getRoleString(user.role),
        action: 'CREATE_USER',
        entity_type: 'user',
        entity_id: user.id,
        description: `Admin created user: ${user.email} (role=${getRoleString(user.role)})`,
      },
    });

    return mapUserToDto(user);
  }

  /**
   * PUT /api/admin/users/:id
   * Updates allowed fields for an existing user.
   * Password is NOT updated here — use the change-password endpoint.
   */
  static async updateUser(
    userId: string,
    data: {
      name?: string;
      email?: string;
      role?: number;
      departmentId?: number | null;
      isActive?: boolean;
      rollNo?: string;
      programType?: string;
      branch?: string;
      studyYear?: string;
      designation?: string;
      globalRoutingKey?: string;
    },
    actorName: string,
  ) {
    // Verify target user exists
    const existing = await prisma.users.findUnique({ where: { id: userId } });
    if (!existing) return null;

    // If email is being changed, check for conflicts
    if (data.email) {
      const emailLower = data.email.trim().toLowerCase();
      const conflict = await prisma.users.findFirst({
        where: { email: emailLower, id: { not: userId } },
      });
      if (conflict) throw new Error('EMAIL_TAKEN');
      data.email = emailLower;
    }

    if (data.rollNo && data.rollNo.trim() !== '') {
      const rollConflict = await prisma.users.findFirst({
        where: {
          roll_no: data.rollNo.trim(),
          role: data.role !== undefined ? data.role : existing.role,
          id: { not: userId }
        }
      });
      if (rollConflict) throw new Error('ROLL_NO_TAKEN');
    }

    const payload: any = { updated_at: new Date() };
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.email !== undefined) payload.email = data.email;
    if (data.role !== undefined) payload.role = data.role;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    if (data.departmentId !== undefined) {
      if (data.departmentId === null) {
        payload.departments_users_department_idTodepartments = { disconnect: true };
      } else {
        payload.departments_users_department_idTodepartments = { connect: { id: data.departmentId } };
      }
    }
    if (data.rollNo !== undefined) payload.roll_no = data.rollNo.trim();
    if (data.programType !== undefined) payload.program_type = data.programType;
    if (data.branch !== undefined) payload.branch = data.branch;
    if (data.studyYear !== undefined) payload.study_year = data.studyYear;
    if (data.designation !== undefined) payload.designation = data.designation;

    const updated = await prisma.users.update({
      where: { id: userId },
      data: payload,
      include: {
        departments_users_department_idTodepartments: {
          select: { name: true, code: true },
        },
      },
    });

    // Audit
    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'UPDATE_USER',
        entity_type: 'user',
        entity_id: userId,
        description: `Admin updated user: ${updated.email}`,
      },
    });

    return mapUserToDto(updated);
  }

  /**
   * DELETE /api/admin/users/:id  (soft delete — sets is_active = false)
   * Hard delete is avoided because users are referenced in tickets / audit_logs.
   */
  static async deleteUser(userId: string, actorName: string) {
    const existing = await prisma.users.findUnique({ where: { id: userId } });
    if (!existing) return false;

    if (existing.is_active) {
      // Step 1: Soft delete (Deactivate)
      await prisma.users.update({
        where: { id: userId },
        data: { is_active: false, updated_at: new Date() },
      });

      await prisma.audit_logs.create({
        data: {
          user_name: actorName,
          action: 'DELETE_USER',
          entity_type: 'user',
          entity_id: userId,
          description: `Admin deactivated user: ${existing.email}`,
        },
      });
      return { status: 'deactivated' };
    } else {
      // Step 2: Hard delete
      try {
        await prisma.users.delete({ where: { id: userId } });
        
        await prisma.audit_logs.create({
          data: {
            user_name: actorName,
            action: 'DELETE_USER',
            entity_type: 'user',
            entity_id: userId,
            description: `Admin hard deleted user: ${existing.email}`,
          },
        });
        return { status: 'deleted' };
      } catch (error: any) {
        throw new Error('HARD_DELETE_FAILED');
      }
    }
  }
}
