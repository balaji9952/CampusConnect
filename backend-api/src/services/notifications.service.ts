import prisma from '../utils/prisma';
import { VisibilityService } from './visibility.service';

export class NotificationsService {
  static async getAll(userId: string, role: string) {
    const visibilityWhere = await VisibilityService.getTicketVisibilityWhereClause(userId, role);

    const whereClause: any = {
      OR: [
        { ticket_id: null },
        { tickets: visibilityWhere }
      ]
    };

    if (VisibilityService.isAdmin(role)) {
      whereClause.AND = [
        {
          OR: [
            { user_id: userId },
            { privileged_only: true },
            { user_id: null }
          ]
        }
      ];
    } else if (VisibilityService.isStaff(role)) {
      whereClause.AND = [
        {
          OR: [
            { user_id: userId },
            { 
              AND: [
                { privileged_only: true },
                { user_id: null }
              ]
            }
          ]
        }
      ];
    } else {
      whereClause.user_id = userId;
      whereClause.privileged_only = false;
    }

    return await prisma.notifications.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      take: 15
    });
  }

  static async markAsRead(id: string, userId: string, role: string) {
    const notification = await prisma.notifications.findUnique({ where: { id } });
    if (!notification) throw new Error('Notification not found');

    if (notification.user_id && notification.user_id !== userId) {
      throw new Error('Forbidden');
    }

    return await prisma.notifications.update({
      where: { id },
      data: { is_read: true }
    });
  }

  static async getUnreadCount(userId: string, role: string) {
    const visibilityWhere = await VisibilityService.getTicketVisibilityWhereClause(userId, role);

    const whereClause: any = {
      is_read: false,
      OR: [
        { ticket_id: null },
        { tickets: visibilityWhere }
      ]
    };

    if (VisibilityService.isAdmin(role)) {
      whereClause.AND = [
        {
          OR: [
            { user_id: userId },
            { privileged_only: true },
            { user_id: null }
          ]
        }
      ];
    } else if (VisibilityService.isStaff(role)) {
      whereClause.AND = [
        {
          OR: [
            { user_id: userId },
            { 
              AND: [
                { privileged_only: true },
                { user_id: null }
              ]
            }
          ]
        }
      ];
    } else {
      whereClause.user_id = userId;
      whereClause.privileged_only = false;
    }

    return await prisma.notifications.count({
      where: whereClause
    });
  }
}
