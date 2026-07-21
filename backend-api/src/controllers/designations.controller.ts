import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { DesignationsService } from '../services/designations.service';
import { isAdminRole } from '../utils/access-control';

function isAdmin(req: AuthRequest): boolean {
  return isAdminRole(req.user?.role);
}

export class DesignationsController {
  /**
   * GET /api/designations
   * Returns all active designations (lightweight — used by mobile if needed).
   */
  static async getAll(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const designations = await DesignationsService.getAll(false);
      res.status(200).json({ success: true, data: designations });
    } catch (error: any) {
      console.error('[DesignationsController.getAll]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /api/designations/admin
   * Returns all designations including inactive ones — for the admin panel.
   */
  static async listAdminDesignations(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }
      const designations = await DesignationsService.getAll(true);
      res.status(200).json({ success: true, data: designations });
    } catch (error: any) {
      console.error('[DesignationsController.listAdminDesignations]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * POST /api/designations
   */
  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const {
        name,
        description,
        is_privileged = false,
        is_hod = false,
        can_escalate = false,
        escalation_level = null,
      } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({ success: false, message: 'name is required' });
        return;
      }

      // Validate escalation_level only when can_escalate is true
      if (can_escalate && (escalation_level === null || escalation_level === undefined)) {
        res.status(400).json({
          success: false,
          message: 'escalation_level is required when can_escalate is true (use 1, 2, or 3)',
        });
        return;
      }

      if (escalation_level !== null && ![1, 2, 3].includes(Number(escalation_level))) {
        res.status(400).json({ success: false, message: 'escalation_level must be 1, 2, or 3' });
        return;
      }

      const designation = await DesignationsService.create({
        name: name.trim(),
        description,
        is_privileged,
        is_hod,
        can_escalate,
        escalation_level: escalation_level !== null ? Number(escalation_level) : null,
      });

      res.status(201).json({ success: true, data: designation, message: 'Designation created successfully' });
    } catch (error: any) {
      if (error.message?.includes('Unique constraint')) {
        res.status(409).json({ success: false, message: 'A designation with this name already exists' });
        return;
      }
      console.error('[DesignationsController.create]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * PUT /api/designations/:name
   */
  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const name = req.params.name as string;
      if (!name) {
        res.status(400).json({ success: false, message: 'Designation name is required' });
        return;
      }

      const { description, is_privileged, is_hod, can_escalate, escalation_level, is_active } = req.body;

      // Validate escalation_level
      if (escalation_level !== undefined && ![1, 2, 3, null].includes(Number(escalation_level))) {
        res.status(400).json({ success: false, message: 'escalation_level must be 1, 2, 3, or null' });
        return;
      }

      const updated = await DesignationsService.update(name, {
        description,
        is_privileged,
        is_hod,
        can_escalate,
        escalation_level: escalation_level !== undefined ? (escalation_level !== null ? Number(escalation_level) : null) : undefined,
        is_active,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'Designation not found' });
        return;
      }

      res.status(200).json({ success: true, data: updated, message: 'Designation updated' });
    } catch (error: any) {
      console.error('[DesignationsController.update]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/designations/:name
   */
  static async remove(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const name = req.params.name as string;
      if (!name) {
        res.status(400).json({ success: false, message: 'Designation name is required' });
        return;
      }

      await DesignationsService.delete(name);
      res.status(200).json({ success: true, message: 'Designation deleted successfully' });
    } catch (error: any) {
      if (error.message?.includes('user(s) are still using it')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message?.includes('Record to delete does not exist')) {
        res.status(404).json({ success: false, message: 'Designation not found' });
        return;
      }
      console.error('[DesignationsController.remove]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
