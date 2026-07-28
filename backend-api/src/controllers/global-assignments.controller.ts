import { Request, Response } from 'express';
import { GlobalAssignmentsService } from '../services/global-assignments.service';

export class GlobalAssignmentsController {
  static async getKeys(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'Admin' && user.role !== 4)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const data = await GlobalAssignmentsService.getSupportedKeys();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[GlobalAssignmentsController.getKeys]', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAssignments(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'Admin' && user.role !== 4)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const data = await GlobalAssignmentsService.getAssignments();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[GlobalAssignmentsController.getAssignments]', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/admin/routing/assignments/by-key
   * Returns all assignments grouped by routing_key with all escalation levels.
   */
  static async getAssignmentsByKey(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'Admin' && user.role !== 4)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const data = await GlobalAssignmentsService.getAssignmentsByKey();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[GlobalAssignmentsController.getAssignmentsByKey]', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async reassignKey(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'Admin' && user.role !== 4)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const { routingGroupId, userId, escalationLevel } = req.body;
      if (!routingGroupId || !userId) {
        res.status(400).json({ success: false, message: 'routingGroupId and userId are required' });
        return;
      }

      // escalationLevel: 1 (default L1), 2, or 3
      const level = escalationLevel !== undefined && escalationLevel !== null
        ? Number(escalationLevel)
        : 1;

      const data = await GlobalAssignmentsService.reassignKey(routingGroupId, userId, user.id, level);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[GlobalAssignmentsController.reassignKey]', error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMetrics(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'Admin' && user.role !== 4)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const data = await GlobalAssignmentsService.getMetrics();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[GlobalAssignmentsController.getMetrics]', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
