import prisma from '../utils/prisma';
import { DesignationsService } from '../services/designations.service';

export class AssignmentRepository {
  /**
   * Retrieves the absolute latest assignment for a single ticket.
   */
  static async getLatestAssignment(ticketId: string) {
    return prisma.ticket_assignments.findFirst({
      where: { ticket_id: ticketId },
      orderBy: { assigned_at: 'desc' },
      include: {
        assignee: {
          select: { id: true, name: true, department_id: true, designation: true, role: true }
        }
      }
    });
  }

  /**
   * Retrieves the latest assignments for MULTIPLE tickets to avoid N+1 queries.
   * Returns a Map of ticket_id -> assignment
   */
  static async getLatestAssignments(ticketIds: string[]) {
    if (!ticketIds.length) return new Map();

    // In SQL Server, finding the latest per group can be done efficiently with ROW_NUMBER()
    // Using Prisma raw query to get exactly one assignment per ticket_id efficiently
    const assignments = await prisma.$queryRaw<any[]>`
      SELECT * FROM (
        SELECT ta.*, u.department_id as assignee_department_id, u.name as assignee_name, u.designation as assignee_designation, u.role as assignee_role,
        ROW_NUMBER() OVER(PARTITION BY ta.ticket_id ORDER BY ta.assigned_at DESC) as rn
        FROM ticket_assignments ta
        LEFT JOIN users u ON ta.assigned_to_user_id = u.id
        WHERE ta.ticket_id IN (${ticketIds.length > 0 ? ticketIds : ['']}) -- Fallback for empty array
      ) as t
      WHERE t.rn = 1
    `;

    const map = new Map<string, any>();
    for (const a of assignments) {
      map.set(a.ticket_id, {
        ...a,
        assignee: a.assigned_to_user_id ? {
          id: a.assigned_to_user_id,
          name: a.assignee_name,
          department_id: a.assignee_department_id,
          designation: a.assignee_designation,
          role: a.assignee_role
        } : null
      });
    }
    return map;
  }

  /**
   * Returns an array of ticket IDs that are currently assigned to the given user.
   */
  static async getTicketsAssignedToUser(userId: string): Promise<string[]> {
    const records = await prisma.$queryRaw<any[]>`
      SELECT ta.ticket_id 
      FROM ticket_assignments ta
      WHERE ta.assigned_to_user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 
        FROM ticket_assignments ta2 
        WHERE ta2.ticket_id = ta.ticket_id 
        AND (ta2.assigned_at > ta.assigned_at OR (ta2.assigned_at = ta.assigned_at AND ta2.id > ta.id))
      )
    `;
    return records.map(r => r.ticket_id);
  }

  /**
   * Returns an array of ticket IDs that are currently assigned to ANY staff member in the given department.
   */
  static async getDepartmentOwnedTickets(departmentId: number): Promise<string[]> {
    const records = await prisma.$queryRaw<any[]>`
      SELECT ta.ticket_id 
      FROM ticket_assignments ta
      LEFT JOIN users u ON ta.assigned_to_user_id = u.id
      WHERE u.department_id = ${departmentId}
      AND NOT EXISTS (
        SELECT 1 
        FROM ticket_assignments ta2 
        WHERE ta2.ticket_id = ta.ticket_id 
        AND (ta2.assigned_at > ta.assigned_at OR (ta2.assigned_at = ta.assigned_at AND ta2.id > ta.id))
      )
    `;
    return records.map(r => r.ticket_id);
  }

  /**
   * Calculates dashboard statistics based strictly on the latest assignment.
   */
  static async getDashboardStatistics(departmentId: number, hodUserId?: string | null) {
    // If HOD is provided, tickets assigned to the HOD (even if HOD is somehow cross-departmental) count towards this dashboard.
    // Usually HOD is in the same department.
    const query = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(t.id) as total_complaints,
        SUM(CASE WHEN t.status = 0 THEN 1 ELSE 0 END) as open_complaints,
        SUM(CASE WHEN t.status = 1 THEN 1 ELSE 0 END) as in_progress_complaints,
        SUM(CASE WHEN t.status = 2 THEN 1 ELSE 0 END) as resolved_complaints,
        SUM(CASE WHEN t.escalation_level > 1 AND t.status NOT IN (2, 4) THEN 1 ELSE 0 END) as escalated_complaints
      FROM tickets t
      WHERE t.is_deleted = false AND t.id IN (
        SELECT ta.ticket_id
        FROM ticket_assignments ta
        LEFT JOIN users u ON ta.assigned_to_user_id = u.id
        WHERE (u.department_id = ${departmentId} OR u.id = ${hodUserId || 'NONE'})
        AND NOT EXISTS (
          SELECT 1 FROM ticket_assignments ta2
          WHERE ta2.ticket_id = ta.ticket_id 
          AND (ta2.assigned_at > ta.assigned_at OR (ta2.assigned_at = ta.assigned_at AND ta2.id > ta.id))
        )
      )
    `;

    return query[0] || {};
  }

  /**
   * Calculates the workload explicitly based on the latest assignment for a department.
   */
  static async getDashboardOwnership(departmentId: number, hodUserId?: string | null) {
    const records = await prisma.$queryRaw<any[]>`
      SELECT u.name as assigned_to_name, COUNT(t.id) as count
      FROM tickets t
      JOIN ticket_assignments ta ON t.id = ta.ticket_id
      LEFT JOIN users u ON ta.assigned_to_user_id = u.id
      WHERE t.is_deleted = false 
        AND t.status IN (0, 1) 
        AND (u.department_id = ${departmentId} OR u.id = ${hodUserId || 'NONE'})
        AND NOT EXISTS (
          SELECT 1 FROM ticket_assignments ta2
          WHERE ta2.ticket_id = ta.ticket_id 
          AND (ta2.assigned_at > ta.assigned_at OR (ta2.assigned_at = ta.assigned_at AND ta2.id > ta.id))
        )
      GROUP BY u.name
    `;
    return records;
  }

  /**
   * Resolves visible ticket IDs for a Staff/HOD based on the single source of truth.
   */
  static async getVisibleTicketIds(userId: string, role: string | number, designation?: string | null, departmentId?: number | null): Promise<string[]> {
    if (role === 'Staff' || role === 1) {
      if (DesignationsService.isHOD(designation ?? null) && departmentId) {
        const records = await prisma.$queryRaw<any[]>`
          SELECT ta.ticket_id 
          FROM ticket_assignments ta
          LEFT JOIN users u ON ta.assigned_to_user_id = u.id
          WHERE (ta.assigned_to_user_id = ${userId} OR u.department_id = ${departmentId})
          AND NOT EXISTS (
            SELECT 1 
            FROM ticket_assignments ta2 
            WHERE ta2.ticket_id = ta.ticket_id 
            AND (ta2.assigned_at > ta.assigned_at OR (ta2.assigned_at = ta.assigned_at AND ta2.id > ta.id))
          )
        `;
        return records.map(r => r.ticket_id);
      }

      // Normal Staff / Global Heads rule: Can view tickets assigned to themselves.
      return await this.getTicketsAssignedToUser(userId);
    }
    
    return [];
  }
}
