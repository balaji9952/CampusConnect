import prisma from '../utils/prisma';
import path from 'path';
import fs from 'fs';
import { randomBytes, randomUUID } from 'crypto';
import { generateQrWithLogo, generateQrUrl, generateQrCard } from '../utils/qr-generator';
import { DesignationsService } from './designations.service';
import { LAYOUT_SPEC_V1 } from '../config/layout-spec';

// Removed legacy category derivation

// ─── DTO ──────────────────────────────────────────────────────────────────────
function mapLocationToDto(l: any) {
  const activeQr = l.qr_codes?.find((qr: any) => qr.is_active) ?? l.qr_codes?.[0] ?? null;

  return {
    id: l.id,
    name: l.name,
    internalCode: l.internal_code ?? null,
    block: l.block ?? null,
    floor: l.floor ?? null,
    isActive: l.is_active,
    departmentId: l.department_id ?? null,
    departmentName: l.departments?.name ?? null,
    routingType: l.location_categories.routing_type ?? null,
    routingGroupId: l.routing_group_id ?? null,
    routingGroupName: l.routing_groups?.display_name ?? null,
    categoryId: l.category_id,
    category: l.location_categories.name ?? 'Unknown',
    createdAt: l.created_at,
    qr: activeQr ? {
      id: activeQr.id,
      token: activeQr.qr_token,
      imageUrl: activeQr.qr_image_url,
      generatedAt: activeQr.generated_at,
      generatedBy: activeQr.users?.name ?? null,
    } : null,
    subLocations: (l.academic_QR_sublocations ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      isActive: s.is_active,
    })),
  };
}

// ─── Role-based location label builder ────────────────────────────────────────
// Student → "Academic" (if department routed) or location name (if global/public routed)
// Staff (matching academic dept) → "Academic-Ground Floor-07" (full path)
// Privileged designations (Admin, Principal, Director, Dean, etc.) → always full path
// Determined dynamically from the designations table — no hardcoded names.
async function buildLocationLabel(params: {
  locationId: number;
  subLocationId?: number | null;
  locationName: string;
  departmentName: string | null;
  floor: string | null;
  subLocationName?: string | null;
  userRole: string;
  userDepartmentId: number | null;
  locationDepartmentId: number | null;
  routingType?: string;
  routingGroupId?: number | null;
}): Promise<string> {
  const { userRole, userDepartmentId, locationDepartmentId, routingType } = params;

  // Check if user has a privileged designation (Admin, Principal, Director, Dean, etc.)
  // Get all privileged designation names from the database.
  const privilegedDesigs = await prisma.designations.findMany({
    where: { is_active: true, is_privileged: true },
    select: { name: true }
  });
  const privilegedNames = privilegedDesigs.map(d => d.name);
  const isPrivileged = privilegedNames.some(r =>
    userRole.toLowerCase().includes(r.toLowerCase())
  );

  // Staff assigned to the same department as the location → sees full path
  const isSameDepartment = userDepartmentId != null && locationDepartmentId != null
    && userDepartmentId === locationDepartmentId;

  const canSeeFull = isPrivileged || isSameDepartment;

  if (routingType === 'GLOBAL') {
    // Public/global locations (Library, Hostel, Canteen, etc.) show their actual names
    const base = params.locationName;
    const floor = params.floor ? `-${params.floor}` : '';
    const subLoc = params.subLocationName ? `-${params.subLocationName}` : '';
    return `${base}${floor}${subLoc}`;
  }

  if (!canSeeFull) {
    return 'Academic';
  }

  // Build full path: "DepartmentName" or "DepartmentName-Floor" or "DepartmentName-Floor-SubLocation"
  const dept = params.departmentName ?? 'General';
  const floor = params.floor ? `-${params.floor}` : '';
  const subLoc = params.subLocationName ? `-${params.subLocationName}` : '';

  return `${dept}${floor}${subLoc}`;
}

// ─── College logo URL ─────────────────────────────────────────────────────────
const COLLEGE_LOGO_URL = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://mountzion.ac.in/logo.png';
// We'll overlay this via QR payload and a compose endpoint.
// For now the QR image itself is generated server-side with logo baked in via qrcode library.

const LOCATION_INCLUDES = {
  departments: {
    select: { name: true },
  },
  location_categories: true,
  routing_groups: true,
  academic_QR_sublocations: {
    where: { is_active: true },
    orderBy: { name: 'asc' },
  },
  qr_codes: {
    where: { is_active: true, sub_location_id: null }, // location-level QR only
    include: {
      users: { select: { name: true } }, // who generated it
    },
    orderBy: { generated_at: 'desc' },
    take: 1
  }
} as const;

export interface ListLocationsQuery {
  search?: string;
  status?: string;   // 'active' | 'inactive'
  departmentId?: string;
  categoryId?: string;
  page?: string;
  limit?: string;
}

export class LocationsService {
  /**
   * GET /api/locations/categories
   * Returns category list with location counts (for the filter pills row).
   */
  static async getCategoryStats() {
    const categories = await prisma.location_categories.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' }
    });

    const counts = await prisma.locations.groupBy({
      by: ['category_id'],
      where: { is_active: true },
      _count: true
    });

    const countMap = Object.fromEntries(counts.map(c => [c.category_id, c._count]));

    const result = categories.map(cat => ({
      categoryId: cat.id,
      category: cat.name,
      routingType: cat.routing_type,
      count: countMap[cat.id] || 0
    }));

    const totalLocations = await prisma.locations.count({ where: { is_active: true } });
    return [{ categoryId: null, category: 'All', count: totalLocations }, ...result];
  }

  /**
   * GET /api/locations
   * Paginated list of locations with optional search, department, and category filters.
   */
  static async listLocations(query: ListLocationsQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s } },
        { block: { contains: s } },
        { floor: { contains: s } },
        { internal_code: { contains: s } },
      ];
    }

    if (query.status === 'active') where.is_active = true;
    if (query.status === 'inactive') where.is_active = false;
    if (query.departmentId) where.department_id = parseInt(query.departmentId, 10);

    // Category filtering
    if (query.categoryId && query.categoryId !== 'All' && query.categoryId !== '') {
      where.category_id = parseInt(query.categoryId, 10);
    }

    const [total, locations] = await Promise.all([
      prisma.locations.count({ where }),
      prisma.locations.findMany({
        where,
        include: LOCATION_INCLUDES,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      data: locations.map(mapLocationToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * GET /api/locations/:id
   */
  static async getLocationById(id: number) {
    const location = await prisma.locations.findUnique({
      where: { id },
      include: LOCATION_INCLUDES,
    });
    if (!location) return null;
    return mapLocationToDto(location);
  }

  /**
   * POST /api/locations
   */
  static async createLocation(data: {
    name: string;
    internalCode?: string | null;
    block?: string | null;
    floor?: string | null;
    departmentId?: number | null;
    routingGroupId?: number | null;
    isActive?: boolean;
    categoryId: number;
  }, actorId: string, actorName: string, baseUrl?: string) {
    const name = data.name.trim();

    // Check unique name constraint
    const existing = await prisma.locations.findUnique({ where: { name } });
    if (existing) throw new Error('LOCATION_NAME_EXISTS');

    const category = await prisma.location_categories.findUnique({ where: { id: data.categoryId } });
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
      },
      include: LOCATION_INCLUDES,
    });

    // Generate the standard high-resolution QR card with QR-XXXX format using getOrGenerateQr
    await LocationsService.getOrGenerateQr(location.id, actorId, actorName, null, baseUrl);

    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'CREATE_LOCATION',
        entity_type: 'location',
        entity_id: String(location.id),
        description: `Admin created location: ${location.name} with auto-generated QR`,
      },
    });

    // Re-fetch to include the newly created QR code in the DTO
    const locationWithQr = await prisma.locations.findUnique({
      where: { id: location.id },
      include: LOCATION_INCLUDES,
    });

    return mapLocationToDto(locationWithQr!);
  }

  /**
   * PUT /api/locations/:id
   */
  static async updateLocation(
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
    });
    if (!existing) return null;

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      const conflict = await prisma.locations.findFirst({
        where: { name: trimmed, id: { not: id } },
      });
      if (conflict) throw new Error('LOCATION_NAME_EXISTS');
      data.name = trimmed;
    }

    if (data.departmentId !== undefined && data.departmentId !== null) {
      const dept = await prisma.departments.findUnique({ where: { id: data.departmentId } });
      if (!dept) throw new Error('DEPARTMENT_NOT_FOUND');
    }

    const payload: any = {};
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
    if (data.categoryId !== undefined) payload.category_id = data.categoryId;

    const updated = await prisma.locations.update({
      where: { id },
      data: payload,
      include: LOCATION_INCLUDES,
    });

    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'UPDATE_LOCATION',
        entity_type: 'location',
        entity_id: String(id),
        description: `Admin updated location: ${updated.name}`,
      },
    });

    return mapLocationToDto(updated);
  }

  /**
   * POST /api/locations/regenerate-all
   * Batch-regenerates QR codes for ALL locations.
   * Deactivates old QR codes and creates fresh ones.
   * Returns a summary of how many were regenerated.
   */
  static async regenerateAllQrs(actorId: string, actorName: string, baseUrl?: string) {
    const locations = await prisma.locations.findMany({
      where: { is_active: true },
      select: { id: true, name: true, block: true, floor: true },
    });

    let regenerated = 0;
    const errors: string[] = [];

    // Find the latest QrNumber from QR_MASTER (or qr_codes starting with QR-)
    const lastQr = await prisma.qR_MASTER.findFirst({
      where: { QrNumber: { startsWith: 'QR-' } },
      orderBy: { Id: 'desc' }
    });

    let nextNumber = 1000;
    if (lastQr) {
      const match = lastQr.QrNumber.match(/\d+$/);
      if (match) {
        nextNumber = parseInt(match[0], 10) + 1;
      }
    } else {
      const lastQrCode = await prisma.qr_codes.findFirst({
        where: { qr_token: { startsWith: 'QR-' } },
        orderBy: { id: 'desc' }
      });
      if (lastQrCode) {
        const match = lastQrCode.qr_token.match(/\d+$/);
        if (match) {
          nextNumber = parseInt(match[0], 10) + 1;
        }
      }
    }

    for (const loc of locations) {
      try {
        // Delete all existing QR codes for this location (location-level only)
        await prisma.qr_codes.deleteMany({
          where: { location_id: loc.id, sub_location_id: null },
        });

        const qrNumber = `QR-${nextNumber}`;
        nextNumber++;

        const scanBaseUrl = process.env.QR_SCAN_BASE_URL || (baseUrl ? baseUrl.replace(/\/$/, '') : 'https://campus-connect-9a7c6.web.app');
        const qrPayload = `${scanBaseUrl}/scan/${qrNumber}`;
        const qrFilename = qrNumber;

        let qrImageUrl: string;
        try {
          qrImageUrl = (await generateQrCard({
            payload: qrPayload,
            filename: qrFilename,
            locationName: loc.name,
            floor: loc.floor || '',
            qrNumber: qrNumber,
            spec: LAYOUT_SPEC_V1,
            target: { dpi: 150 }
          })).imageUrl;
        } catch (err) {
          console.warn(`[RegenerateAll] QR logo failed for loc ${loc.id}, using fallback:`, err);
          qrImageUrl = generateQrUrl(qrPayload);
        }

        await prisma.qr_codes.create({
          data: {
            location_id: loc.id,
            qr_token: qrNumber,
            qr_image_url: qrImageUrl,
            generated_by: actorId,
            is_active: true,
          },
        });

        // Write to QR_MASTER
        await prisma.qR_MASTER.create({
          data: {
            QrNumber: qrNumber,
            Location: loc.name,
            Block: loc.block || '',
            Floor: loc.floor || '',
            QrValue: qrPayload,
            PngPath: `/uploads/qrcodes/${qrNumber}.png`,
            PdfPath: null,
            Status: 'Active',
            QrImageBase64: null
          }
        });

        regenerated++;
      } catch (err: any) {
        errors.push(`${loc.name}: ${err.message}`);
        console.error(`[RegenerateAll] Failed for location ${loc.id} (${loc.name}):`, err);
      }
    }

    await prisma.audit_logs.create({
      data: {
        user_id: actorId,
        user_name: actorName,
        action: 'QR_REGENERATED_ALL',
        entity_type: 'locations',
        entity_id: 'ALL',
        description: `${actorName} regenerated QR codes for ${regenerated} of ${locations.length} locations`,
      },
    });

    return { total: locations.length, regenerated, errors };
  }

  /**
   * DELETE /api/locations/:id/qr
   * Deletes all QR codes for a specific location.
   */
  static async deleteQr(id: number, actorId: string, actorName: string, subLocationId?: number | null) {
    const whereClause: any = { location_id: id };
    if (subLocationId !== undefined) {
      whereClause.sub_location_id = subLocationId;
    } else {
      whereClause.sub_location_id = null;
    }

    const deleted = await prisma.qr_codes.deleteMany({
      where: whereClause,
    });

    if (deleted.count > 0) {
      await prisma.audit_logs.create({
        data: {
          user_id: actorId,
          user_name: actorName,
          action: 'QR_DELETED',
          entity_type: 'locations',
          entity_id: String(id),
          description: `${actorName} deleted QR code for location ${id}${subLocationId ? ` (sub-location ${subLocationId})` : ''}`,
        },
      });
    }

    return deleted.count;
  }

  /**
   * GET /api/locations/:id/qr
   * Retrieves the active QR code for a location (or sub-location), or generates a new one.
   * On regeneration: deactivates all previous QR codes and writes QR_REGENERATED audit.
   */
  static async getOrGenerateQr(
    id: number,
    actorId: string,
    actorName: string,
    subLocationId?: number | null,
    baseUrl?: string
  ) {
    const location = await prisma.locations.findUnique({
      where: { id },
      include: {
        qr_codes: {
          where: {
            is_active: true,
            sub_location_id: subLocationId ?? null,
          },
          orderBy: { generated_at: 'desc' },
          take: 1,
          include: { users: { select: { name: true } } },
        },
      },
    });

    if (!location) throw new Error('LOCATION_NOT_FOUND');

    let qr = location.qr_codes[0];

    // If no active QR exists, generate a new one (includes first-time and regeneration)
    if (!qr) {
      // Deactivate ALL previous QR codes for this location + sub-location combo
      const oldQrs = await prisma.qr_codes.findMany({
        where: {
          location_id: id,
          sub_location_id: subLocationId ?? null,
        },
        select: { id: true },
      });
      const oldQrIds = oldQrs.map((q) => q.id);

      if (oldQrIds.length > 0) {
        await prisma.qr_codes.deleteMany({
          where: { id: { in: oldQrIds } },
        });
      }

      // Find the latest QrNumber from QR_MASTER (or qr_codes starting with QR-)
      const lastQr = await prisma.qR_MASTER.findFirst({
        where: { QrNumber: { startsWith: 'QR-' } },
        orderBy: { Id: 'desc' }
      });

      let nextNumber = 1000;
      if (lastQr) {
        const match = lastQr.QrNumber.match(/\d+$/);
        if (match) {
          nextNumber = parseInt(match[0], 10) + 1;
        }
      } else {
        const lastQrCode = await prisma.qr_codes.findFirst({
          where: { qr_token: { startsWith: 'QR-' } },
          orderBy: { id: 'desc' }
        });
        if (lastQrCode) {
          const match = lastQrCode.qr_token.match(/\d+$/);
          if (match) {
            nextNumber = parseInt(match[0], 10) + 1;
          }
        }
      }

      const qrNumber = `QR-${nextNumber}`;
      const scanBaseUrl = process.env.QR_SCAN_BASE_URL || (baseUrl ? baseUrl.replace(/\/$/, '') : 'https://campus-connect-9a7c6.web.app');
      const qrPayload = `${scanBaseUrl}/scan/${qrNumber}`;
      const qrFilename = qrNumber;

      let qrImageUrl: string;
      try {
        qrImageUrl = (await generateQrCard({
          payload: qrPayload,
          filename: qrFilename,
          locationName: location.name,
          floor: location.floor || '',
          qrNumber: qrNumber,
          spec: LAYOUT_SPEC_V1,
          target: { dpi: 150 }
        })).imageUrl;
      } catch (err) {
        console.warn('[LocationsService] QR logo overlay failed, using fallback:', err);
        qrImageUrl = generateQrUrl(qrPayload);
      }

      qr = await prisma.qr_codes.create({
        data: {
          location_id: id,
          sub_location_id: subLocationId ?? null,
          qr_token: qrNumber,
          qr_image_url: qrImageUrl,
          generated_by: actorId,
          is_active: true,
        },
        include: { users: { select: { name: true } } },
      });

      // Write to QR_MASTER
      await prisma.qR_MASTER.create({
        data: {
          QrNumber: qrNumber,
          Location: location.name,
          Block: location.block || '',
          Floor: location.floor || '',
          QrValue: qrPayload,
          PngPath: `/uploads/qrcodes/${qrNumber}.png`,
          PdfPath: null,
          Status: 'Active',
          QrImageBase64: null
        }
      });

      const auditAction = oldQrIds.length > 0 ? 'QR_REGENERATED' : 'GENERATE_LOCATION_QR';
      await prisma.audit_logs.create({
        data: {
          user_id: actorId,
          user_name: actorName,
          action: auditAction,
          entity_type: 'locations',
          entity_id: String(id),
          old_value: oldQrIds.length > 0 ? JSON.stringify({ oldQrIds }) : null,
          new_value: JSON.stringify({ newQrId: qr.id }),
          description: `${actorName} ${oldQrIds.length > 0 ? 'regenerated' : 'generated'} QR for ${subLocationId ? `sub-location (id=${subLocationId}) of ` : ''}location: ${location.name}`,
        },
      });
    } else {
      // Only generate image if missing on disk (e.g. after container restart) to keep GET requests fast and zero-RAM
      const qrPath = path.join(process.cwd(), 'uploads', 'qrcodes', `${qr.qr_token}.png`);
      if (!fs.existsSync(qrPath)) {
        const scanBaseUrl = process.env.QR_SCAN_BASE_URL || (baseUrl ? baseUrl.replace(/\/$/, '') : 'https://campus-connect-9a7c6.web.app');
        const qrPayload = `${scanBaseUrl}/scan/${qr.qr_token}`;
        try {
          await generateQrCard({
            payload: qrPayload,
            filename: qr.qr_token,
            locationName: location.name,
            floor: location.floor || '',
            qrNumber: qr.qr_token,
            spec: LAYOUT_SPEC_V1,
            target: { dpi: 100 }
          });
        } catch (err) {
          console.warn('[getOrGenerateQr] Missing file generation fallback:', err);
        }
      }
    }

    return {
      id: qr.id,
      subLocationId: qr.sub_location_id ?? null,
      token: qr.qr_token,
      imageUrl: qr.qr_image_url,
      generatedAt: qr.generated_at,
      generatedBy: (qr as any).users?.name ?? null,
    };
  }

  /**
   * POST /api/locations/verify-qr
   * Verifies a QR code scanned by a student and issues a short-lived verification token.
   *
   * Security controls:
   * - JWT authenticated (enforced at route level)
   * - Rate limited (30/user/hr, 100/IP/hr)
   * - Strong payload validation (Zod, pre-parsed)
   * - Audit logs for every outcome (success, all failure types, security alerts)
   * - Single active token per user (invalidates previous sessions)
   * - 10-minute token TTL
   * - Failed scan tracking with SECURITY_ALERT at 5 failures in 10 minutes
   *
   * Role-based label rules:
   * - Student → "Academic"
   * - Staff matching location's department → full path (e.g., "Academic-Ground Floor-07")
   * - Principal/Director/Admin → always full path
   */
  static async verifyQr(
    qrCode: string,
    userId: string,
    userName: string,
    userRole: string,
    userDepartmentId: number | null,
    ip?: string,
    deviceId?: string
  ): Promise<{
    locationId: number;
    subLocationId: number | null;
    locationLabel: string;   // role-filtered display label (what the user sees)
    verificationToken: string;
    category: string;
  }> {
    // ── Parse payload (supports both location-level and sub-location QR formats) ──
    let locationId: number;
    let subLocationId: number | null = null;
    let token: string;

    const trimmed = qrCode.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('/scan/')) {
      const parts = trimmed.split('/');
      token = parts[parts.length - 1];

      const qrRecord = await prisma.qr_codes.findUnique({
        where: { qr_token: token }
      });
      if (!qrRecord) {
        await prisma.audit_logs.create({
          data: {
            user_id: userId,
            user_name: userName,
            action: 'QR_INVALID',
            entity_type: 'locations',
            entity_id: '0',
            new_value: JSON.stringify({ ip, deviceId, qrCode }),
            description: `Invalid URL QR scan: token=${token}`,
          },
        });
        throw new Error('QR_INVALID');
      }
      locationId = qrRecord.location_id;
      subLocationId = qrRecord.sub_location_id;
    } else {
      const payload = JSON.parse(trimmed) as {
        locationId: number;
        subLocationId?: number;
        token: string;
      };
      locationId = payload.locationId;
      subLocationId = payload.subLocationId ?? null;
      token = payload.token;
    }

    // ── Helper: write failure audit and track for SECURITY_ALERT ────────────
    const auditFailure = async (action: string, description: string) => {
      await prisma.audit_logs.create({
        data: {
          user_id: userId,
          user_name: userName,
          action,
          entity_type: 'locations',
          entity_id: String(locationId),
          new_value: JSON.stringify({ ip, deviceId, locationId, subLocationId }),
          description,
        },
      });

      // Count recent failures in the last 10 minutes for SECURITY_ALERT
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentFailures = await prisma.audit_logs.count({
        where: {
          user_id: userId,
          action: { in: ['QR_INVALID', 'QR_DISABLED', 'QR_EXPIRED'] },
          created_at: { gt: tenMinAgo },
        },
      });

      if (recentFailures >= 5) {
        await prisma.audit_logs.create({
          data: {
            user_id: userId,
            user_name: userName,
            action: 'SECURITY_ALERT',
            entity_type: 'users',
            entity_id: userId,
            new_value: JSON.stringify({ recentFailures: recentFailures + 1, ip, deviceId }),
            description: `SECURITY ALERT: User exceeded 5 invalid QR scan attempts within 10 minutes.`,
          },
        });
        console.warn(`[SECURITY] User ${userId} triggered SECURITY_ALERT: ${recentFailures + 1} failed QR scans in 10 min`);
      }
    };

    // ── 1. Lookup QR record (match by token and location_id, optionally sub_location_id) ──
    const qrRecord = await prisma.qr_codes.findFirst({
      where: {
        qr_token: token,
        location_id: locationId,
        ...(subLocationId ? { sub_location_id: subLocationId } : { sub_location_id: null }),
      },
    });

    if (!qrRecord) {
      await auditFailure('QR_INVALID', `Invalid QR scan for locationId=${locationId}, subLocationId=${subLocationId ?? 'null'}`);
      throw new Error('QR_INVALID');
    }

    if (!qrRecord.is_active) {
      await auditFailure('QR_DISABLED', `Scan of disabled QR id=${qrRecord.id} for locationId=${locationId}`);
      throw new Error('QR_DISABLED');
    }

    if (qrRecord.expires_at && qrRecord.expires_at < new Date()) {
      await auditFailure('QR_EXPIRED', `Scan of expired QR id=${qrRecord.id} for locationId=${locationId}`);
      throw new Error('QR_EXPIRED');
    }

    // ── 2. Validate location ─────────────────────────────────────────────────
    const location = await prisma.locations.findUnique({
      where: { id: locationId },
      include: {
        departments: { select: { id: true, name: true } },
        location_categories: true,
      },
    });
    if (!location || !location.is_active) {
      await auditFailure('QR_INVALID', `QR scan for inactive/missing location id=${locationId}`);
      throw new Error('LOCATION_INACTIVE');
    }

    // ── 3. Validate sub-location if present ─────────────────────────────────
    let subLocation: { id: number; name: string } | null = null;
    if (subLocationId) {
      subLocation = await prisma.academic_QR_sublocations.findFirst({
        where: { id: subLocationId, is_active: true },
      });
      if (!subLocation) {
        await auditFailure('QR_INVALID', `QR scan for inactive/missing sub-location id=${subLocationId}`);
        throw new Error('QR_INVALID');
      }
    }

    // ── 4. Build role-filtered location label ────────────────────────────────
    const displayLabel = await buildLocationLabel({
      locationId,
      subLocationId: subLocationId ?? null,
      locationName: location.name,
      departmentName: location.departments?.name ?? null,
      floor: location.floor ?? null,
      subLocationName: subLocation?.name ?? undefined,
      userRole,
      userDepartmentId,
      locationDepartmentId: location.department_id ?? null,
      routingType: location.location_categories?.routing_type,
      routingGroupId: location.routing_group_id ?? null,
    });

    // ── 5. Single-active-token rule: invalidate previous unused sessions ─────
    await prisma.qr_verification_sessions.updateMany({
      where: { user_id: userId, used: false, expires_at: { gt: new Date() } },
      data: { used: true },
    });

    // ── 6. Issue new 10-minute verification token ─────────────────────────────
    const verificationToken = randomUUID();

    const session = await prisma.qr_verification_sessions.create({
      data: {
        token: verificationToken,
        user_id: userId,
        location_id: locationId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        created_by_ip: ip ?? null,
        device_id: deviceId ?? null,
      },
    });

    // ── 7. Structured QR_VERIFIED audit log ──────────────────────────────────
    await prisma.audit_logs.create({
      data: {
        user_id: userId,
        user_name: userName,
        action: 'QR_VERIFIED',
        entity_type: 'locations',
        entity_id: String(locationId),
        new_value: JSON.stringify({
          sessionId: session.id, locationId, subLocationId: subLocationId ?? null,
          displayLabel, ip, deviceId
        }),
        description: `${userName} verified QR → "${displayLabel}"`,
      },
    });

    return {
      locationId: location.id,
      subLocationId: subLocationId ?? null,
      locationLabel: displayLabel,
      verificationToken,
      category: location.location_categories?.name ?? "Unknown",
    };
  }

  // ─── Sub-location CRUD ─────────────────────────────────────────────────────

  /**
   * GET /api/locations/:id/sub-locations
   */
  static async listSubLocations(locationId: number) {
    const location = await prisma.locations.findUnique({ where: { id: locationId } });
    if (!location) throw new Error('LOCATION_NOT_FOUND');

    const subs = await prisma.academic_QR_sublocations.findMany({
      where: { location_id: locationId },
      orderBy: { name: 'asc' },
    });

    // Fetch active QR codes for all sub-locations in one query
    const subIds = subs.map(s => s.id);
    const qrCodes = await prisma.qr_codes.findMany({
      where: {
        sub_location_id: { in: subIds },
        is_active: true,
      },
      orderBy: { generated_at: 'desc' },
    });

    const qrBySub = new Map<number, (typeof qrCodes)[0]>();
    for (const qr of qrCodes) {
      if (qr.sub_location_id != null && !qrBySub.has(qr.sub_location_id)) {
        qrBySub.set(qr.sub_location_id, qr);
      }
    }

    return subs.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      isActive: s.is_active,
      qr: (qrBySub.get(s.id)) ? {
        id: qrBySub.get(s.id)!.id,
        token: qrBySub.get(s.id)!.qr_token,
        imageUrl: qrBySub.get(s.id)!.qr_image_url,
        generatedAt: qrBySub.get(s.id)!.generated_at,
      } : null,
    }));
  }

  /**
   * POST /api/locations/:id/sub-locations
   */
  static async createSubLocation(
    locationId: number,
    data: { name: string; description?: string | null },
    actorId: string,
    actorName: string
  ) {
    const location = await prisma.locations.findUnique({ where: { id: locationId } });
    if (!location) throw new Error('LOCATION_NOT_FOUND');

    const name = data.name.trim();
    const existing = await prisma.academic_QR_sublocations.findFirst({
      where: { location_id: locationId, name },
    });
    if (existing) throw new Error('SUBLOCATION_NAME_EXISTS');

    const sub = await prisma.academic_QR_sublocations.create({
      data: {
        location_id: locationId,
        name,
        description: data.description?.trim() ?? null,
      },
    });

    await prisma.audit_logs.create({
      data: {
        user_id: actorId,
        user_name: actorName,
        action: 'CREATE_SUBLOCATION',
        entity_type: 'academic_QR_sublocations',
        entity_id: String(sub.id),
        description: `${actorName} created sub-location "${name}" for location "${location.name}"`,
      },
    });

    return { id: sub.id, name: sub.name, description: sub.description, isActive: sub.is_active };
  }

  /**
   * PUT /api/locations/:locationId/sub-locations/:id
   */
  static async updateSubLocation(
    locationId: number,
    subLocationId: number,
    data: { name?: string; description?: string | null; isActive?: boolean },
    actorName: string
  ) {
    const sub = await prisma.academic_QR_sublocations.findFirst({
      where: { id: subLocationId, location_id: locationId },
    });
    if (!sub) throw new Error('SUBLOCATION_NOT_FOUND');

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      const conflict = await prisma.academic_QR_sublocations.findFirst({
        where: { location_id: locationId, name: trimmed, id: { not: subLocationId } },
      });
      if (conflict) throw new Error('SUBLOCATION_NAME_EXISTS');
      data.name = trimmed;
    }

    const updated = await prisma.academic_QR_sublocations.update({
      where: { id: subLocationId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
      },
    });

    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'UPDATE_SUBLOCATION',
        entity_type: 'academic_QR_sublocations',
        entity_id: String(subLocationId),
        description: `${actorName} updated sub-location "${updated.name}"`,
      },
    });

    return { id: updated.id, name: updated.name, description: updated.description, isActive: updated.is_active };
  }

  /**
   * DELETE /api/locations/:locationId/sub-locations/:id
   */
  static async deleteSubLocation(locationId: number, subLocationId: number, actorName: string) {
    const sub = await prisma.academic_QR_sublocations.findFirst({
      where: { id: subLocationId, location_id: locationId },
    });
    if (!sub) return false;

    // Manually deactivate associated QR codes (no cascade from sub_loc → qr_codes)
    await prisma.qr_codes.updateMany({
      where: { sub_location_id: subLocationId },
      data: { is_active: false },
    });

    await prisma.academic_QR_sublocations.delete({ where: { id: subLocationId } });

    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'DELETE_SUBLOCATION',
        entity_type: 'academic_QR_sublocations',
        entity_id: String(subLocationId),
        description: `${actorName} deleted sub-location "${sub.name}"`,
      },
    });

    return true;
  }

  /**
   * DELETE /api/locations/:id
   */
  static async deleteLocation(id: number, actorName: string) {
    const existing = await prisma.locations.findUnique({ where: { id } });
    if (!existing) return false;

    // Check if complaints/tickets are linked to this location
    const ticketCount = await prisma.tickets.count({ where: { location_id: id } });

    if (ticketCount > 0) {
      // If complaints exist, soft-delete (deactivate) location to maintain ticket integrity
      await prisma.locations.update({
        where: { id },
        data: { is_active: false },
      });

      // Deactivate associated QR codes
      await prisma.qr_codes.updateMany({
        where: { location_id: id },
        data: { is_active: false },
      });
    } else {
      // Safe hard-delete: clean up related records first
      await prisma.qr_codes.deleteMany({ where: { location_id: id } });
      await prisma.academic_QR_sublocations.deleteMany({ where: { location_id: id } });
      await prisma.locations.delete({ where: { id } });
    }

    await prisma.audit_logs.create({
      data: {
        user_name: actorName,
        action: 'DELETE_LOCATION',
        entity_type: 'location',
        entity_id: String(id),
        description: `Admin deleted/deactivated location: ${existing.name}${ticketCount > 0 ? ' (deactivated due to linked tickets)' : ''}`,
      },
    });

    return true;
  }
}
