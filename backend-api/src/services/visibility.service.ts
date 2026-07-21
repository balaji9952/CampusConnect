import prisma from '../utils/prisma';
import { DesignationsService } from './designations.service';

export class VisibilityService {
  /**
   * Helper to determine privileged access.
   * Uses the designations table instead of hardcoded strings.
   */
  static isAdmin(role: string | number, designation?: string | null): boolean {
    if (role === 'Admin' || role === 3) return true;
    return DesignationsService.isPrivileged(designation ?? null);
  }

  static isStaff(role: string | number): boolean {
    return role === 'Staff' || role === 1;
  }

  static isHOD(designation?: string | null): boolean {
    return DesignationsService.isHOD(designation ?? null);
  }

  static isStudentOrParent(role: string | number): boolean {
    return role === 'Student' || role === 'Parent' || role === 0 || role === 2;
  }

  /**
   * Returns a Prisma WHERE clause object for ticket visibility based on user role and permissions.
   */
  static async getTicketVisibilityWhereClause(userId: string, role: string | number) {
    const baseWhere: any = { is_deleted: false };

    const userRecord = await prisma.users.findUnique({
      where: { id: userId },
      select: { department_id: true, designation: true }
    });

    if (!userRecord) {
      baseWhere.id = 'NOT_FOUND';
      return baseWhere;
    }

    if (this.isAdmin(role, userRecord.designation)) {
      // Admins and Principals see everything
      return baseWhere;
    }

    if (this.isStudentOrParent(role)) {
      // Students and Parents only see their own tickets
      baseWhere.creator_id = userId;
      return baseWhere;
    }

    if (this.isStaff(role)) {
      // Use the AssignmentRepository to resolve visibility based STRICTLY on the Latest Assignment
      const { AssignmentRepository } = require('../repositories/AssignmentRepository');
      const visibleTicketIds = await AssignmentRepository.getVisibleTicketIds(
        userId, 
        role, 
        userRecord.designation, 
        userRecord.department_id
      );

      baseWhere.id = { in: visibleTicketIds };
      return baseWhere;
    }

    // Default fallback
    baseWhere.id = 'UNRECOGNIZED_ROLE';
    return baseWhere;
  }

  /**
   * Returns a boolean indicating if the user is authorized to modify the ticket.
   */
  static async canModifyTicket(userId: string, role: string | number, ticketId: string): Promise<boolean> {
    const userRecord = await prisma.users.findUnique({
      where: { id: userId },
      select: { designation: true }
    });

    if (this.isAdmin(role, userRecord?.designation)) {
      return true;
    }

    const { AssignmentRepository } = require('../repositories/AssignmentRepository');
    const latestAssignment = await AssignmentRepository.getLatestAssignment(ticketId);

    if (latestAssignment && latestAssignment.assigned_to_user_id === userId) {
      return true;
    }

    return false;
  }

  /**
   * Returns a list of user IDs who are authorized to view the given ticket.
   */
  static async getUsersWithTicketVisibility(ticketId: string): Promise<string[]> {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) return [];

    const authorizedUserIds = new Set<string>();

    // 1. Creator
    authorizedUserIds.add(ticket.creator_id);

    // 2. Assigned Staff & HOD
    const { AssignmentRepository } = require('../repositories/AssignmentRepository');
    const latestAssignment = await AssignmentRepository.getLatestAssignment(ticketId);
    
    if (latestAssignment && latestAssignment.assigned_to_user_id) {
      authorizedUserIds.add(latestAssignment.assigned_to_user_id);

      // If assigned to a departmental staff, their HODs can also view it
      // HODs are identified dynamically via the designations table.
      if (latestAssignment.assignee?.department_id) {
        const hodDesignations = await prisma.designations.findMany({
          where: { is_active: true, is_hod: true },
          select: { name: true }
        });
        const hodNames = hodDesignations.map(d => d.name);
        if (hodNames.length > 0) {
          const hods = await prisma.users.findMany({
            where: {
              department_id: latestAssignment.assignee.department_id,
              designation: { in: hodNames },
              is_active: true
            },
            select: { id: true }
          });
          hods.forEach(hod => authorizedUserIds.add(hod.id));
        }
      }
    }

    // 3. All privileged designations (Admin, Principal, Director, Dean, etc.)
    // Reads from the designations table dynamically — no hardcoded names.
    const allDesignations = await prisma.designations.findMany({
      where: { is_active: true, is_privileged: true },
      select: { name: true }
    });
    const privilegedNames = allDesignations.map(d => d.name);

    if (privilegedNames.length > 0) {
      const privilegedUsers = await prisma.users.findMany({
        where: { designation: { in: privilegedNames }, is_active: true },
        select: { id: true }
      });
      privilegedUsers.forEach(u => authorizedUserIds.add(u.id));
    }

    return Array.from(authorizedUserIds);
  }
}
