import * as fs from 'fs';
import * as path from 'path';

const locSvcPath = path.join(__dirname, '..', 'src', 'services', 'locations.service.ts');
let svc = fs.readFileSync(locSvcPath, 'utf8');

// 1. listLocations Category filtering
svc = svc.replace(
  `    // Category filtering
    if (query.category && query.category !== 'All' && query.category !== '') {
      where.category = query.category;
    }`,
  `    // Category filtering
    if (query.categoryId && query.categoryId !== 'All' && query.categoryId !== '') {
      where.category_id = parseInt(query.categoryId, 10);
    }`
);

// 2. createLocation signature and validation
svc = svc.replace(
  `  static async createLocation(data: {
    name: string;
    internalCode?: string | null;
    block?: string | null;
    floor?: string | null;
    departmentId?: number | null;
    routingType?: string;
    routingKey?: string | null;
    isActive?: boolean;
    category?: string | null;
  }, actorId: string, actorName: string, baseUrl?: string) {`,
  `  static async createLocation(data: {
    name: string;
    internalCode?: string | null;
    block?: string | null;
    floor?: string | null;
    departmentId?: number | null;
    routingGroupId?: number | null;
    isActive?: boolean;
    categoryId: number;
  }, actorId: string, actorName: string, baseUrl?: string) {`
);

svc = svc.replace(
  `    // Validation for routing rules
    const rType = data.routingType ?? 'DEPARTMENT_ROUTED';
    if (rType === 'GLOBAL_ROUTED' && !data.routingKey) {
      throw new Error('ROUTING_KEY_REQUIRED');
    }
    if (rType === 'DEPARTMENT_ROUTED') {
      data.routingKey = null;
    }

    // Check department validity if provided
    if (data.departmentId) {
      const dept = await prisma.departments.findUnique({ where: { id: data.departmentId } });
      if (!dept) throw new Error('DEPARTMENT_NOT_FOUND');
    }

    // Create location without QR first so we have the real location.id
    const location = await prisma.locations.create({
      data: {
        name,
        internal_code: data.internalCode?.trim() || null,
        block: data.block ?? null,
        floor: data.floor ?? null,
        department_id: data.departmentId ?? null,
        routing_type: data.routingType ?? 'DEPARTMENT_ROUTED',
        routing_key: data.routingKey ?? null,
        category: data.category || 'General',
        is_active: data.isActive !== false,
      },`,
  `    const category = await prisma.location_categories.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new Error('CATEGORY_NOT_FOUND');

    // Validation for routing rules
    if (category.routing_type === 'GLOBAL' && !data.routingGroupId) {
      throw new Error('ROUTING_GROUP_REQUIRED');
    }
    if (category.routing_type === 'DEPARTMENT' && !data.departmentId) {
      throw new Error('DEPARTMENT_REQUIRED');
    }

    if (category.routing_type === 'DEPARTMENT') {
      data.routingGroupId = null;
    } else {
      data.departmentId = null;
    }

    // Check department validity if provided
    if (data.departmentId) {
      const dept = await prisma.departments.findUnique({ where: { id: data.departmentId } });
      if (!dept) throw new Error('DEPARTMENT_NOT_FOUND');
    }

    // Create location without QR first so we have the real location.id
    const location = await prisma.locations.create({
      data: {
        name,
        internal_code: data.internalCode?.trim() || null,
        block: data.block ?? null,
        floor: data.floor ?? null,
        department_id: data.departmentId ?? null,
        routing_group_id: data.routingGroupId ?? null,
        category_id: data.categoryId,
        is_active: data.isActive !== false,
      },`
);

// 3. updateLocation signature and validation
svc = svc.replace(
  `  static async updateLocation(
    id: number,
    data: {
      name?: string;
      internalCode?: string | null;
      block?: string | null;
      floor?: string | null;
      departmentId?: number | null;
      routingType?: string;
      routingKey?: string | null;
      isActive?: boolean;
      category?: string | null;
    },
    actorName: string
  ) {
    const existing = await prisma.locations.findUnique({ where: { id } });`,
  `  static async updateLocation(
    id: number,
    data: {
      name?: string;
      internalCode?: string | null;
      block?: string | null;
      floor?: string | null;
      departmentId?: number | null;
      routingGroupId?: number | null;
      isActive?: boolean;
      categoryId?: number;
    },
    actorName: string
  ) {
    const existing = await prisma.locations.findUnique({ 
      where: { id },
      include: { location_categories: true }
    });`
);

svc = svc.replace(
  `    const payload: any = {};
    const finalRoutingType = data.routingType !== undefined ? data.routingType : existing.routing_type;
    const finalRoutingKey = data.routingKey !== undefined ? data.routingKey : existing.routing_key;

    if (finalRoutingType === 'GLOBAL_ROUTED' && !finalRoutingKey) {
      throw new Error('VALIDATION_ERROR: GLOBAL_ROUTED locations must have a routing_key.');
    }
    if (finalRoutingType === 'DEPARTMENT_ROUTED') {
      data.routingKey = null;
      payload.routing_key = null;
    }
    if (data.name !== undefined) payload.name = data.name;
    if (data.internalCode !== undefined) payload.internal_code = data.internalCode?.trim() || null;
    if (data.block !== undefined) payload.block = data.block;
    if (data.floor !== undefined) payload.floor = data.floor;
    if (data.departmentId !== undefined) payload.department_id = data.departmentId;
    if (data.routingType !== undefined) payload.routing_type = data.routingType;
    if (data.routingKey !== undefined) payload.routing_key = data.routingKey;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    if (data.category !== undefined) payload.category = data.category;`,
  `    const payload: any = {};
    const finalCategoryId = data.categoryId !== undefined ? data.categoryId : existing.category_id;
    const category = await prisma.location_categories.findUnique({ where: { id: finalCategoryId } });
    if (!category) throw new Error('CATEGORY_NOT_FOUND');

    const finalRoutingGroupId = data.routingGroupId !== undefined ? data.routingGroupId : existing.routing_group_id;
    const finalDepartmentId = data.departmentId !== undefined ? data.departmentId : existing.department_id;

    if (category.routing_type === 'GLOBAL' && !finalRoutingGroupId) {
      throw new Error('VALIDATION_ERROR: GLOBAL routed locations must have a routing_group_id.');
    }
    if (category.routing_type === 'DEPARTMENT' && !finalDepartmentId) {
      throw new Error('VALIDATION_ERROR: DEPARTMENT routed locations must have a department_id.');
    }

    if (category.routing_type === 'DEPARTMENT') {
      payload.routing_group_id = null;
    } else {
      payload.routing_group_id = finalRoutingGroupId;
    }

    if (category.routing_type === 'GLOBAL') {
      payload.department_id = null;
    } else {
      payload.department_id = finalDepartmentId;
    }

    if (data.name !== undefined) payload.name = data.name;
    if (data.internalCode !== undefined) payload.internal_code = data.internalCode?.trim() || null;
    if (data.block !== undefined) payload.block = data.block;
    if (data.floor !== undefined) payload.floor = data.floor;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    if (data.categoryId !== undefined) payload.category_id = data.categoryId;`
);

fs.writeFileSync(locSvcPath, svc);

const locCtrlPath = path.join(__dirname, '..', 'src', 'controllers', 'locations.controller.ts');
let ctrl = fs.readFileSync(locCtrlPath, 'utf8');

ctrl = ctrl.replace(
  `        category:     req.query.category as string | undefined,`,
  `        categoryId:   req.query.categoryId as string | undefined,`
);

ctrl = ctrl.replace(
  `const { name, internalCode, block, floor, departmentId, routingType, routingKey, isActive, category } = req.body;`,
  `const { name, internalCode, block, floor, departmentId, routingGroupId, isActive, categoryId } = req.body;`
);

ctrl = ctrl.replace(
  `if (!category) {
        res.status(400).json({ success: false, message: 'category is required' });
        return;
      }`,
  `if (!categoryId) {
        res.status(400).json({ success: false, message: 'categoryId is required' });
        return;
      }`
);

ctrl = ctrl.replace(
  `        routingType,
        routingKey,
        isActive,
        category`,
  `        routingGroupId,
        isActive,
        categoryId: parseInt(categoryId, 10)`
);

ctrl = ctrl.replace(
  `      const { name, internalCode, block, floor, departmentId, routingType, routingKey, isActive, category } = req.body;`,
  `      const { name, internalCode, block, floor, departmentId, routingGroupId, isActive, categoryId } = req.body;`
);

ctrl = ctrl.replace(
  `          departmentId: departmentId ? parseInt(departmentId, 10) : null,
          routingType,
          routingKey,
          isActive,
          category`,
  `          departmentId: departmentId ? parseInt(departmentId, 10) : null,
          routingGroupId: routingGroupId ? parseInt(routingGroupId, 10) : null,
          isActive,
          categoryId: categoryId ? parseInt(categoryId, 10) : undefined`
);

fs.writeFileSync(locCtrlPath, ctrl);
console.log('Update script finished successfully.');
