import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { DepartmentsService, ListDeptsQuery } from '../services/departments.service';
import { DesignationsService } from '../services/designations.service';
import prisma from '../utils/prisma';
import { isAdminRole } from '../utils/access-control';

// ─── Guard ────────────────────────────────────────────────────────────────────
function isAdmin(req: AuthRequest): boolean {
  return isAdminRole(req.user?.role);
}

export class DepartmentsController {
  /**
   * GET /api/departments
   * Query: search, status, page, limit
   */
  static async listDepartments(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const query: ListDeptsQuery = {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        page:   req.query.page   as string | undefined,
        limit:  req.query.limit  as string | undefined,
      };

      const result = await DepartmentsService.listDepartments(query);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      console.error('[DepartmentsController.listDepartments]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /api/departments/:id
   */
  static async getDepartmentById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid department id' });
        return;
      }

      const dept = await DepartmentsService.getDepartmentById(id);
      if (!dept) {
        res.status(404).json({ success: false, message: 'Department not found' });
        return;
      }

      res.status(200).json({ success: true, data: dept });
    } catch (error: any) {
      console.error('[DepartmentsController.getDepartmentById]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /api/departments/:id/dashboard
   */
  static async getDepartmentDashboard(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid department id' });
        return;
      }

      const dashboardData = await DepartmentsService.getDepartmentDashboard(id);
      if (!dashboardData) {
        res.status(404).json({ success: false, message: 'Department not found' });
        return;
      }

      // Serialize BigInt safely
      const safe = JSON.parse(JSON.stringify(dashboardData, (_k, v) =>
        typeof v === 'bigint' ? Number(v) : v
      ));

      res.status(200).json({ success: true, data: safe });
    } catch (error: any) {
      console.error('[DepartmentsController.getDepartmentDashboard]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * POST /api/departments
   * Body: { name, code?, hodUserId?, isActive? }
   */
  static async createDepartment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const { name, code, hodUserId, isActive } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({ success: false, message: 'name is required' });
        return;
      }

      const dept = await DepartmentsService.createDepartment({ name, code, hodUserId, isActive });
      res.status(201).json({ success: true, data: dept, message: 'Department created successfully' });
    } catch (error: any) {
      if (error.message === 'DEPT_NAME_EXISTS') {
        res.status(409).json({ success: false, message: 'A department with this name already exists' });
        return;
      }
      if (error.message === 'DEPT_CODE_EXISTS') {
        res.status(409).json({ success: false, message: 'A department with this code already exists' });
        return;
      }
      if (error.message === 'HOD_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'HOD user not found' });
        return;
      }
      if (error.message === 'HOD_INACTIVE') {
        res.status(400).json({ success: false, message: 'HOD user is inactive' });
        return;
      }
      console.error('[DepartmentsController.createDepartment]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * PUT /api/departments/:id
   * Body: any subset of { name, code, hodUserId, isActive }
   * Pass hodUserId: null to explicitly clear the HOD.
   * Pass code: null to explicitly clear the code.
   */
  static async updateDepartment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid department id' });
        return;
      }

      const actorName = req.user?.name ?? 'Admin';
      const { name, code, hodUserId, isActive } = req.body;

      const updated = await DepartmentsService.updateDepartment(
        id,
        { name, code, hodUserId, isActive },
        actorName,
      );

      if (!updated) {
        res.status(404).json({ success: false, message: 'Department not found' });
        return;
      }

      res.status(200).json({ success: true, data: updated, message: 'Department updated' });
    } catch (error: any) {
      if (error.message === 'DEPT_NAME_EXISTS') {
        res.status(409).json({ success: false, message: 'A department with this name already exists' });
        return;
      }
      if (error.message === 'DEPT_CODE_EXISTS') {
        res.status(409).json({ success: false, message: 'A department with this code already exists' });
        return;
      }
      if (error.message === 'HOD_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'HOD user not found' });
        return;
      }
      if (error.message === 'HOD_INACTIVE') {
        res.status(400).json({ success: false, message: 'HOD user is inactive' });
        return;
      }
      console.error('[DepartmentsController.updateDepartment]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/departments/:id   (soft delete)
   */
  static async deleteDepartment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid department id' });
        return;
      }

      const actorName = req.user?.name ?? 'Admin';
      const deleted = await DepartmentsService.deleteDepartment(id, actorName);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Department not found' });
        return;
      }

      res.status(200).json({ success: true, message: 'Department deactivated successfully' });
    } catch (error: any) {
      console.error('[DepartmentsController.deleteDepartment]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /api/departments/:id/staff/:staffId/complaints
   */
  static async getActiveStaffComplaints(req: AuthRequest, res: Response): Promise<void> {
    try {
      const actorRoleStr = String(req.user?.role);
      const isAuthorized = actorRoleStr === 'Admin' || actorRoleStr === '3' || actorRoleStr === 'Staff' || actorRoleStr === '1';
      if (!isAuthorized) {
        res.status(403).json({ success: false, message: 'Insufficient permissions to transfer complaints' });
        return;
      }

      const departmentId = parseInt(req.params.id as string, 10);
      const staffId = req.params.staffId as string;
      
      const complaints = await DepartmentsService.getActiveStaffComplaints(departmentId, staffId);
      if (!complaints) {
        res.status(404).json({ success: false, message: 'Department not found' });
        return;
      }
      res.status(200).json({ success: true, data: complaints });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * POST /api/departments/:id/bulk-transfer
   */
  static async bulkTransferTickets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const actorId = req.user!.id;
      const actorName = req.user!.name;
      const actorRoleStr = String(req.user?.role);
      const actorDesignation = (req.user as any)?.designation || '';

      const departmentId = req.params.id === 'admin' ? 0 : parseInt(req.params.id as string, 10);

      // Authorization Enforcement
      let isAuthorized = (actorRoleStr === 'Admin' || actorRoleStr === '3');
      if (!isAuthorized) {
        if (actorRoleStr === 'Staff' || actorRoleStr === '1') {
          if (departmentId !== 0) {
            // Verify if they are HOD of this dept
            const dept = await prisma.departments.findUnique({ where: { id: departmentId } });
            if (dept?.hod_user_id === actorId || DesignationsService.isHOD(actorDesignation)) {
              isAuthorized = true;
            }
          }
        }
      }

      if (!isAuthorized) {
        res.status(403).json({ success: false, message: 'Insufficient permissions to transfer complaints' });
        return;
      }
      
      const { tickets, toStaffId, reason, idempotencyKey } = req.body;

      if (!idempotencyKey) {
        res.status(400).json({ success: false, message: 'idempotencyKey is required' });
        return;
      }
      
      if (!Array.isArray(tickets) || tickets.length === 0) {
        res.status(400).json({ success: false, message: 'tickets array is required' });
        return;
      }
      
      if (tickets.length > 100) {
        res.status(400).json({ success: false, message: 'Bulk transfer limit exceeded (max 100)' });
        return;
      }

      const crypto = require('crypto');
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({ departmentId, tickets, toStaffId, reason })).digest('hex');

      // Idempotency verification
      const existingKey = await prisma.idempotency_keys.findUnique({ where: { key: idempotencyKey } });
      if (existingKey) {
        if (existingKey.request_hash !== requestHash) {
          res.status(400).json({ success: false, message: 'Idempotency key reused with different payload' });
          return;
        }
        res.status(existingKey.status_code || 200).json(JSON.parse(existingKey.response_body || '{}'));
        return;
      }

      await prisma.idempotency_keys.create({
        data: {
          key: idempotencyKey,
          user_id: actorId,
          request_path: req.originalUrl,
          request_hash: requestHash,
          status: 'PROCESSING',
        }
      });

      try {
        const result = await DepartmentsService.bulkTransferTickets(departmentId, { tickets, toStaffId, reason }, actorId, actorName, actorRoleStr);
        
        await prisma.idempotency_keys.update({
          where: { key: idempotencyKey },
          data: {
            status: 'COMPLETED',
            status_code: 200,
            response_body: JSON.stringify({ success: true, ...result })
          }
        });

        res.status(200).json({ success: true, ...result });
      } catch (serviceError: any) {
        const errPayload = { success: false, message: serviceError.message || 'Transfer failed' };
        await prisma.idempotency_keys.update({
          where: { key: idempotencyKey },
          data: {
            status: 'FAILED',
            status_code: 400,
            response_body: JSON.stringify(errPayload)
          }
        });
        res.status(400).json(errPayload);
      }
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
