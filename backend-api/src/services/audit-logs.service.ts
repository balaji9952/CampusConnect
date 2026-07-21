import prisma from '../utils/prisma';

export class AuditLogsService {
  static async getAll(page: number, limit: number, filters: any) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.user_id) {
      where.user_id = filters.user_id;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.startDate || filters.endDate) {
      where.created_at = {};
      if (filters.startDate) {
        where.created_at.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.created_at.lte = new Date(filters.endDate);
      }
    }

    const [total, rawLogs] = await Promise.all([
      prisma.audit_logs.count({ where }),
      prisma.audit_logs.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          user_id: true,
          user_name: true,
          user_role: true,
          action: true,
          entity_type: true,
          entity_id: true,
          description: true,
          created_at: true
        }
      })
    ]);

    const logs = rawLogs.map(log => ({
      ...log,
      id: log.id.toString()
    }));

    return {
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
