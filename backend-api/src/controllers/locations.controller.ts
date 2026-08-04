import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { LocationsService, ListLocationsQuery } from '../services/locations.service';
import { VerifyQrSchema } from '../validators/locations.validator';
import { isAdminRole } from '../utils/access-control';
import { generateQrCard } from '../utils/qr-generator';
import { LAYOUT_SPEC_V1 } from '../config/layout-spec';
import * as path from 'path';
import * as fs from 'fs';

function isAdmin(req: AuthRequest): boolean {
  return isAdminRole(req.user?.role);
}

export class LocationsController {
  /**
   * GET /api/locations/categories
   * Returns category filter pills with location counts.
   */
  static async getCategoryStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await LocationsService.getCategoryStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      console.error('[LocationsController.getCategoryStats]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /api/locations
   */
  static async listLocations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const query: ListLocationsQuery = {
        search:       req.query.search as string | undefined,
        status:       req.query.status as string | undefined,
        departmentId: req.query.departmentId as string | undefined,
        categoryId:   req.query.categoryId as string | undefined,
        page:         req.query.page   as string | undefined,
        limit:        req.query.limit  as string | undefined,
      };

      const result = await LocationsService.listLocations(query);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      console.error('[LocationsController.listLocations]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /api/locations/:id
   */
  static async getLocationById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid location id' });
        return;
      }

      const location = await LocationsService.getLocationById(id);
      if (!location) {
        res.status(404).json({ success: false, message: 'Location not found' });
        return;
      }

      res.status(200).json({ success: true, data: location });
    } catch (error: any) {
      console.error('[LocationsController.getLocationById]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * POST /api/locations
   */
  static async createLocation(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const { name, internalCode, block, floor, departmentId, routingGroupId, isActive, categoryId } = req.body;
      const actorId = req.user?.id;
      const actorName = req.user?.name ?? 'Admin';

      if (!name || !name.trim()) {
        res.status(400).json({ success: false, message: 'name is required' });
        return;
      }
      if (!actorId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const parsedDeptId = departmentId ? parseInt(String(departmentId), 10) : null;

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      const location = await LocationsService.createLocation(
        { name, internalCode, block, floor, departmentId: parsedDeptId, routingGroupId, isActive, categoryId },
        actorId,
        actorName,
        baseUrl
      );

      res.status(201).json({ success: true, data: location, message: 'Location created successfully' });
    } catch (error: any) {
      if (error.message === 'LOCATION_NAME_EXISTS') {
        res.status(409).json({ success: false, message: 'A location with this name already exists' });
        return;
      }
      if (error.message === 'DEPARTMENT_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Department not found' });
        return;
      }
      console.error('[LocationsController.createLocation]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * PUT /api/locations/:id
   */
  static async updateLocation(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid location id' });
        return;
      }

      const { name, internalCode, block, floor, departmentId, routingGroupId, isActive, categoryId } = req.body;
      const actorName = req.user?.name ?? 'Admin';

      const parsedDeptId = departmentId !== undefined
        ? (departmentId === null ? null : parseInt(String(departmentId), 10))
        : undefined;

      const updated = await LocationsService.updateLocation(
        id,
        { name, internalCode, block, floor, departmentId: parsedDeptId, routingGroupId, isActive, categoryId },
        actorName
      );

      if (!updated) {
        res.status(404).json({ success: false, message: 'Location not found' });
        return;
      }

      res.status(200).json({ success: true, data: updated, message: 'Location updated' });
    } catch (error: any) {
      if (error.message === 'LOCATION_NAME_EXISTS') {
        res.status(409).json({ success: false, message: 'A location with this name already exists' });
        return;
      }
      if (error.message === 'DEPARTMENT_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Department not found' });
        return;
      }
      console.error('[LocationsController.updateLocation]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /api/locations/:id/qr
   * GET /api/locations/:locationId/sub-locations/:subLocationId/qr
   */
  static async getQr(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id       = parseInt(String(req.params.id ?? req.params.locationId), 10);
      const rawSubId = req.params.subLocationId;
      const subIdStr = Array.isArray(rawSubId) ? rawSubId[0] : rawSubId;
      const subLocationId = subIdStr ? parseInt(subIdStr, 10) : null;

      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid location id' });
        return;
      }
      if (subIdStr !== undefined && isNaN(subLocationId!)) {
        res.status(400).json({ success: false, message: 'Invalid sub-location id' });
        return;
      }

      const actorId   = req.user?.id;
      const actorName = req.user?.name ?? 'Admin';

      if (!actorId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      const qrInfo = await LocationsService.getOrGenerateQr(id, actorId, actorName, subLocationId, baseUrl);

      res.status(200).json({ success: true, data: qrInfo });
    } catch (error: any) {
      if (error.message === 'LOCATION_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Location not found' });
        return;
      }
      console.error('[LocationsController.getQr]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /api/locations/:id/pdf
   * GET /api/locations/:locationId/sub-locations/:subLocationId/pdf
   * Streams the dynamically rendered A4 PDF sheet for the location QR code on-the-fly.
   */
  static async getPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id       = parseInt(String(req.params.id ?? req.params.locationId), 10);
      const rawSubId = req.params.subLocationId;
      const subIdStr = Array.isArray(rawSubId) ? rawSubId[0] : rawSubId;
      const subLocationId = subIdStr ? parseInt(subIdStr, 10) : null;

      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid location id' });
        return;
      }
      if (subIdStr !== undefined && isNaN(subLocationId!)) {
        res.status(400).json({ success: false, message: 'Invalid sub-location id' });
        return;
      }

      // Fetch the location details (to check existence and read fields)
      const location = await LocationsService.getLocationById(id);
      if (!location) {
        res.status(404).json({ success: false, message: 'Location not found' });
        return;
      }

      // Find the QR code token for this location
      let qrRecord = location.qr;
      if (!qrRecord) {
        // If no QR exists, we must get or generate it first
        const actorId = req.user?.id;
        const actorName = req.user?.name ?? 'Admin';
        if (!actorId) {
          res.status(401).json({ success: false, message: 'Unauthorized' });
          return;
        }
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const baseUrl = `${protocol}://${host}`;
        qrRecord = await LocationsService.getOrGenerateQr(id, actorId, actorName, subLocationId, baseUrl);
      }

      const qrToken = qrRecord.token;
      const qrFilename = qrToken;
      const qrPath = path.join(process.cwd(), 'uploads', 'qrcodes', `${qrFilename}.png`);

      // Ensure the high-resolution (600 DPI) visual card PNG is generated
      if (!fs.existsSync(qrPath)) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const scanBaseUrl = `${protocol}://${host}`;
        const qrPayload = `${scanBaseUrl}/scan/${qrToken}`;

        await generateQrCard({
          payload: qrPayload,
          filename: qrFilename,
          locationName: location.name,
          floor: location.floor || '',
          qrNumber: qrToken,
          spec: LAYOUT_SPEC_V1,
          target: { dpi: 200 } // lightweight target (200 DPI)
        });
      }

      // Create PDF using PDFKit
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4', margin: 0 });

      // A4 dimensions: 595.28 x 841.89 points
      // Card target: 350 x 525 points
      const cardWidth = 350;
      const cardHeight = 525;
      const x = (595.28 - cardWidth) / 2;
      const y = (841.89 - cardHeight) / 2;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${qrToken}.pdf`);

      doc.pipe(res);
      doc.image(qrPath, x, y, { width: cardWidth, height: cardHeight });
      doc.end();
    } catch (error: any) {
      console.error('[LocationsController.getPdf]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/locations/:id/qr
   * DELETE /api/locations/:locationId/sub-locations/:subLocationId/qr
   */
  static async deleteQr(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id       = parseInt(String(req.params.id ?? req.params.locationId), 10);
      const rawSubId = req.params.subLocationId;
      const subIdStr = Array.isArray(rawSubId) ? rawSubId[0] : rawSubId;
      const subLocationId = subIdStr ? parseInt(subIdStr, 10) : null;

      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid location id' });
        return;
      }
      if (subIdStr !== undefined && isNaN(subLocationId!)) {
        res.status(400).json({ success: false, message: 'Invalid sub-location id' });
        return;
      }

      const actorId   = req.user?.id;
      const actorName = req.user?.name ?? 'Admin';

      if (!actorId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const count = await LocationsService.deleteQr(id, actorId, actorName, subLocationId);
      res.status(200).json({ success: true, message: `Deleted ${count} QR codes` });
    } catch (error: any) {
      console.error('[LocationsController.deleteQr]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/locations/:id
   */
  static async deleteLocation(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid location id' });
        return;
      }

      const actorName = req.user?.name ?? 'Admin';

      const deleted = await LocationsService.deleteLocation(id, actorName);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Location not found' });
        return;
      }

      res.status(200).json({ success: true, message: 'Location deleted' });
    } catch (error: any) {
      console.error('[LocationsController.deleteLocation]', error);
      const isConstraintError = error.code === 'P2003' || error.message?.includes('foreign key constraint');
      const message = isConstraintError 
        ? 'Cannot delete location: Complaints or tickets are linked to this location.'
        : (error.message || 'Internal server error');
      res.status(400).json({ success: false, message });
    }
  }

  /**
   * POST /api/locations/regenerate-all
   * Batch-regenerates QR codes for all active locations.
   */
  static async regenerateAllQrs(req: AuthRequest, res: Response): Promise<void> {
    if (!isAdmin(req)) {
      res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
      return;
    }
    const actorId   = req.user?.id;
    const actorName = req.user?.name ?? 'Admin';
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      const result = await LocationsService.regenerateAllQrs(actorId, actorName, baseUrl);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('[LocationsController.regenerateAllQrs]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * POST /api/locations/verify-qr
   * Student endpoint — JWT required (enforced at route), rate-limited.
   * Verifies a QR code and returns a 10-minute verification token.
   * Applies role-based location label (student → "Academic", staff → full path).
   */
  static async verifyQr(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const parsed = VerifyQrSchema.safeParse({ body: req.body });
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'QR_INVALID',
          message: parsed.error.issues[0]?.message ?? 'Invalid QR payload',
        });
        return;
      }

      const { qrCode } = parsed.data.body;
      const userId         = req.user?.id   as string;
      const userName       = req.user?.name as string;
      const userRole       = req.user?.role as string;
      const userDepartmentId = req.user?.departmentId as number | null;
      const ip             = req.ip ?? undefined;
      const deviceId        = req.headers['x-device-id'] as string | undefined;

      const result = await LocationsService.verifyQr(
        qrCode, userId, userName, userRole, userDepartmentId, ip, deviceId
      );

      res.status(200).json({
        success:          true,
        locationId:       result.locationId,
        subLocationId:    result.subLocationId,
        locationLabel:    result.locationLabel,
        verificationToken: result.verificationToken,
        category:         result.category,
      });
    } catch (error: any) {
      const errorMap: Record<string, [number, string]> = {
        QR_INVALID:        [400, 'Invalid QR code. Please scan a valid campus QR.'],
        QR_DISABLED:       [403, 'This QR code has been disabled by an administrator.'],
        QR_EXPIRED:        [403, 'This QR code has expired. Please ask admin to regenerate.'],
        LOCATION_INACTIVE: [403, 'This location is currently inactive.'],
      };
      const [status, message] = errorMap[error.message] ?? [500, 'Internal server error'];
      console.error('[LocationsController.verifyQr]', error.message);
      res.status(status).json({ success: false, error: error.message, message });
    }
  }

  // ─── Sub-location endpoints ──────────────────────────────────────────────

  /**
   * GET /api/locations/:id/sub-locations
   */
  static async listSubLocations(req: AuthRequest, res: Response): Promise<void> {
    if (!isAdmin(req)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid location id' });
      return;
    }
    try {
      const subs = await LocationsService.listSubLocations(id);
      res.status(200).json({ success: true, data: subs });
    } catch (error: any) {
      if (error.message === 'LOCATION_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Location not found' });
        return;
      }
      console.error('[LocationsController.listSubLocations]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * POST /api/locations/:id/sub-locations
   */
  static async createSubLocation(req: AuthRequest, res: Response): Promise<void> {
    if (!isAdmin(req)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid location id' });
      return;
    }
    const { name, description } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ success: false, message: 'name is required' });
      return;
    }
    const actorId   = req.user?.id   as string;
    const actorName = req.user?.name ?? 'Admin';

    try {
      const sub = await LocationsService.createSubLocation(id, { name, description }, actorId, actorName);
      res.status(201).json({ success: true, data: sub });
    } catch (error: any) {
      if (error.message === 'LOCATION_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Location not found' });
        return;
      }
      if (error.message === 'SUBLOCATION_NAME_EXISTS') {
        res.status(409).json({ success: false, message: 'A sub-location with this name already exists in this location' });
        return;
      }
      console.error('[LocationsController.createSubLocation]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * PUT /api/locations/:locationId/sub-locations/:subLocationId
   */
  static async updateSubLocation(req: AuthRequest, res: Response): Promise<void> {
    if (!isAdmin(req)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    const locationId = parseInt(String(req.params.id), 10);
    const subId      = parseInt(String(req.params.subLocationId), 10);
    if (isNaN(locationId) || isNaN(subId)) {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }
    const { name, description, isActive } = req.body;
    const actorName = req.user?.name ?? 'Admin';

    try {
      const updated = await LocationsService.updateSubLocation(
        locationId, subId, { name, description, isActive }, actorName
      );
      res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      if (error.message === 'SUBLOCATION_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Sub-location not found' });
        return;
      }
      if (error.message === 'SUBLOCATION_NAME_EXISTS') {
        res.status(409).json({ success: false, message: 'A sub-location with this name already exists in this location' });
        return;
      }
      console.error('[LocationsController.updateSubLocation]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/locations/:locationId/sub-locations/:subLocationId
   */
  static async deleteSubLocation(req: AuthRequest, res: Response): Promise<void> {
    if (!isAdmin(req)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    const locationId = parseInt(String(req.params.id), 10);
    const subId      = parseInt(String(req.params.subLocationId), 10);
    if (isNaN(locationId) || isNaN(subId)) {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }
    const actorName = req.user?.name ?? 'Admin';

    try {
      const deleted = await LocationsService.deleteSubLocation(locationId, subId, actorName);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Sub-location not found' });
        return;
      }
      res.status(200).json({ success: true, message: 'Sub-location deleted' });
    } catch (error: any) {
      console.error('[LocationsController.deleteSubLocation]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
