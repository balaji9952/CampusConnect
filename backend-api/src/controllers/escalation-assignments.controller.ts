import { Request, Response } from 'express';
import { EscalationAssignmentsService } from '../services/escalation-assignments.service';

export class EscalationAssignmentsController {
  static async getAll(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'Admin' && user.role !== 4)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const data = await EscalationAssignmentsService.getAll();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[EscalationAssignmentsController.getAll]', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async upsert(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'Admin' && user.role !== 4)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const { departmentId, escalationLevel, userId } = req.body;
      if (!departmentId || !escalationLevel || !userId) {
        return res.status(400).json({ success: false, message: 'departmentId, escalationLevel (2 or 3), and userId are required' });
      }

      const data = await EscalationAssignmentsService.upsert(
        Number(departmentId),
        Number(escalationLevel) as 2 | 3,
        userId,
        user.id
      );
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[EscalationAssignmentsController.upsert]', error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'Admin' && user.role !== 4)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const deptId = parseInt(String(req.params.deptId));
      const level = parseInt(String(req.params.level));
      if (isNaN(deptId) || isNaN(level)) {
        return res.status(400).json({ success: false, message: 'Invalid department or level' });
      }

      await EscalationAssignmentsService.remove(deptId, level as 2 | 3);
      res.json({ success: true, message: 'Assignment removed' });
    } catch (error: any) {
      console.error('[EscalationAssignmentsController.remove]', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
