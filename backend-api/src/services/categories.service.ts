import prisma from '../utils/prisma';

export interface ListCategoriesAdminQuery {
  search?: string;
  page?: string;
  limit?: string;
}

export class CategoriesService {
  /**
   * GET /api/categories/admin
   * Paginated list of categories including inactive ones, with open complaint count.
   */
  static async listAdminCategories(query: ListCategoriesAdminQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s } },
        { description: { contains: s } },
      ];
    }

    const [total, categories] = await Promise.all([
      prisma.complaint_categories.count({ where }),
      prisma.complaint_categories.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sort_order: 'asc' },
        include: {
          _count: {
            select: {
              tickets: {
                where: {
                  status: { in: [0, 1] },
                  is_deleted: false,
                }
              }
            }
          }
        }
      }),
    ]);

    const mappedData = categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      routingType: c.routing_type,
      routingKey: c.routing_key,
      sortOrder: c.sort_order,
      isActive: c.is_active,
      createdAt: c.created_at,
      openComplaints: c._count.tickets,
      slaResponseHours: c.sla_response_hours,
      slaEscalationHours: c.sla_escalation_hours,
      slaResolutionHours: c.sla_resolution_hours,
    }));

    return {
      data: mappedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * POST /api/categories
   */
  static async createCategory(
    data: {
      name: string;
      description?: string;
      icon?: string;
      routingType?: string;
      routingKey?: string;
      sortOrder: number;
      isActive: boolean;
      slaResponseHours?: number;
      slaEscalationHours?: number;
      slaResolutionHours?: number;
    },
    actorName: string
  ) {
    const name = data.name.trim();

    // Check unique name constraint (case-insensitive)
    const existing = await prisma.complaint_categories.findFirst({
      where: { name: { equals: name } },
    });
    // Wait, prisma string match is case insensitive in SQL Server if collation is CI, but to be sure:
    // Actually SQL Server default collation is typically case-insensitive, but let's just check normally.
    // If we want guaranteed case insensitivity, Prisma's `equals` is based on DB collation.
    
    if (existing && existing.name.toLowerCase() === name.toLowerCase()) {
       throw new Error('CATEGORY_NAME_EXISTS');
    }

    if (data.sortOrder < 1) {
      throw new Error('INVALID_SORT_ORDER');
    }

    const routingType = data.routingType || 'DEPARTMENT_ROUTED';
    let routingKey = data.routingKey || null;

    if (routingType === 'GLOBAL_ROUTED' && !routingKey) {
      throw new Error('GLOBAL_ROUTED categories must have a routing key');
    }
    if (routingType === 'DEPARTMENT_ROUTED') {
      routingKey = null;
    }

    const category = await prisma.complaint_categories.create({
      data: {
        name,
        description: data.description || null,
        icon: data.icon || null,
        routing_type: routingType,
        routing_key: routingKey,
        sort_order: data.sortOrder,
        is_active: data.isActive,
        sla_response_hours: data.slaResponseHours || 24,
        sla_escalation_hours: data.slaEscalationHours || 48,
        sla_resolution_hours: data.slaResolutionHours || 72,
      },
    });

    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'CREATE_CATEGORY',
        entity_type: 'category',
        entity_id: String(category.id),
        description: `Admin created category: ${category.name}`,
      },
    });

    return category;
  }

  /**
   * PUT /api/categories/:id
   */
  static async updateCategory(
    id: number,
    data: {
      name?: string;
      description?: string;
      icon?: string;
      routingType?: string;
      routingKey?: string;
      sortOrder?: number;
      isActive?: boolean;
      slaResponseHours?: number;
      slaEscalationHours?: number;
      slaResolutionHours?: number;
    },
    actorName: string
  ) {
    const existing = await prisma.complaint_categories.findUnique({ where: { id } });
    if (!existing) return null;

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      const conflict = await prisma.complaint_categories.findFirst({
        where: { name: trimmed, id: { not: id } },
      });
      if (conflict && conflict.name.toLowerCase() === trimmed.toLowerCase()) {
        throw new Error('CATEGORY_NAME_EXISTS');
      }
      data.name = trimmed;
    }

    if (data.sortOrder !== undefined && data.sortOrder < 1) {
      throw new Error('INVALID_SORT_ORDER');
    }

    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.icon !== undefined) payload.icon = data.icon;
    
    let routingType = data.routingType !== undefined ? data.routingType : existing.routing_type;
    let routingKey = data.routingKey !== undefined ? data.routingKey : existing.routing_key;
    
    if (routingType === 'GLOBAL_ROUTED' && !routingKey) {
      throw new Error('GLOBAL_ROUTED categories must have a routing key');
    }
    if (routingType === 'DEPARTMENT_ROUTED') {
      routingKey = null;
    }
    
    payload.routing_type = routingType;
    payload.routing_key = routingKey;

    if (data.sortOrder !== undefined) payload.sort_order = data.sortOrder;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    if (data.slaResponseHours !== undefined) payload.sla_response_hours = data.slaResponseHours;
    if (data.slaEscalationHours !== undefined) payload.sla_escalation_hours = data.slaEscalationHours;
    if (data.slaResolutionHours !== undefined) payload.sla_resolution_hours = data.slaResolutionHours;

    const updated = await prisma.complaint_categories.update({
      where: { id },
      data: payload,
    });

    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'UPDATE_CATEGORY',
        entity_type: 'category',
        entity_id: String(id),
        description: `Admin updated category: ${updated.name}`,
      },
    });

    return updated;
  }

  /**
   * DELETE /api/categories/:id
   * Soft delete only.
   */
  static async deleteCategory(id: number, actorName: string) {
    const existing = await prisma.complaint_categories.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await prisma.complaint_categories.update({
      where: { id },
      data: { is_active: false },
    });

    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'DELETE_CATEGORY',
        entity_type: 'category',
        entity_id: String(id),
        description: `Admin soft-deleted category: ${updated.name}`,
      },
    });

    return updated;
  }
}
