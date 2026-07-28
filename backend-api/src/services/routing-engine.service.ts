import { PrismaClient, users, locations, tickets } from '@prisma/client';
import createError from 'http-errors';

export interface AssignedUser {
  id: string;
  name: string;
  designation: string;
  role: string;
}

export interface RoutingContext {
  creator?: Partial<users>;
  location?: Partial<locations>;
  ticket?: Partial<tickets>;
}

export class RoutingEngineService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Evaluates the routing chain for a given location to find the assigned user.
   * Throws explicit 422 errors if assignment is missing.
   *
   * @param locationId The ID of the location to route for
   * @param escalationLevel The escalation level (1, 2, or 3). Default is 1.
   * @param context The routing context containing creator, location, and ticket data.
   * @returns The assignee user details
   */
  async getAssigneeForLocation(locationId: number, escalationLevel: number = 1, context?: RoutingContext): Promise<AssignedUser> {
    const location = await this.prisma.locations.findUnique({
      where: { id: locationId },
      include: {
        location_categories: true,
      }
    });

    if (!location) {
      throw createError(404, `Location with ID ${locationId} not found`);
    }

    if (!location.location_categories) {
      throw createError(422, 'Location is missing a Category configuration.');
    }

    const { routing_type } = location.location_categories;

    if (routing_type === 'DEPARTMENT') {
      let effectiveDepartmentId: number | null = null;

      if (location.department_source === 'CREATOR') {
        effectiveDepartmentId = context?.creator?.department_id ?? null;
      } else {
        effectiveDepartmentId = location.department_id;
      }

      if (!effectiveDepartmentId) {
        throw createError(422, `Department-routed location '${location.name}' is missing a department_id and no valid creator department was provided in the context.`);
      }

      if (escalationLevel === 1) {
        // Level 1: Assigned to the Department's HOD
        const department = await this.prisma.departments.findUnique({
          where: { id: effectiveDepartmentId },
          include: { users_departments_hod_user_idTousers: { select: { id: true, name: true, designation: true } } }
        });
        
        if (!department || !department.users_departments_hod_user_idTousers) {
          throw createError(422, `Department ID ${effectiveDepartmentId} is missing a Head of Department (HOD) assignment.`);
        }
        
        const user = department.users_departments_hod_user_idTousers;
        return { id: user.id, name: user.name, designation: user.designation || 'HOD', role: 'HOD' };
      } else {
        // Level 2/3: Assigned via escalation_assignments for this department
        const escalation = await this.prisma.escalation_assignments.findFirst({
          where: {
            department_id: effectiveDepartmentId,
            escalation_level: escalationLevel,
            is_active: true
          },
          include: { users: { select: { id: true, name: true, designation: true } } }
        });

        if (!escalation || !escalation.users) {
          throw createError(422, `Missing Escalation Level ${escalationLevel} assignment for Department ID ${effectiveDepartmentId}.`);
        }

        const user = escalation.users;
        return { id: user.id, name: user.name, designation: user.designation || 'Escalation Contact', role: 'Escalation Contact' };
      }

    } else if (routing_type === 'GLOBAL') {
      if (!location.routing_group_id) {
        throw createError(422, `Global-routed location '${location.name}' is missing a Routing Group.`);
      }

      const queryFilter = {
        routing_group_id: location.routing_group_id,
        escalation_level: escalationLevel,
        is_active: true
      };

      const globalAssignment = await this.prisma.global_assignments.findFirst({
        where: queryFilter,
        include: { users: { select: { id: true, name: true, designation: true } } }
      });

      if (!globalAssignment || !globalAssignment.users) {
        console.log('\n--- TEMPORARY DEBUG: RoutingEngineService ---');
        console.log('routingGroupId:', location.routing_group_id);
        console.log('Exact Prisma Filter applied:', queryFilter);
        console.log('Raw result from Prisma:', globalAssignment);
        if (globalAssignment && !globalAssignment.users) {
          console.log('User was filtered out or missing!');
        }
        console.log('---------------------------------------------\n');
        throw createError(422, `Missing ${escalationLevel === 1 ? 'Level 1' : 'Level ' + escalationLevel} Global Assignment for Routing Group ID ${location.routing_group_id}.`);
      }

      const user = globalAssignment.users;
      return { id: user.id, name: user.name, designation: user.designation || 'Global Head', role: 'Global Head' };
    }

    throw createError(422, `Unknown routing type '${routing_type}' for Location Category ID ${location.category_id}.`);
  }
}
