import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AuditLogsService } from '../services/audit-logs.service';

export class AuditLogsController {
  static async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role } = req.user;

      if (role === 'Student' || role === 'Parent') {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }

      const pageStr = req.query.page as string;
      const limitStr = req.query.limit as string;

      const page = pageStr ? parseInt(pageStr, 10) : 1;
      const limit = limitStr ? parseInt(limitStr, 10) : 10;

      if (isNaN(page) || page < 1) {
        res.status(400).json({ success: false, message: 'Invalid page parameter' });
        return;
      }

      if (isNaN(limit) || limit < 1 || limit > 100) {
        res.status(400).json({ success: false, message: 'Invalid limit parameter' });
        return;
      }

      const filters: any = {};

      if (req.query.user_id) filters.user_id = req.query.user_id as string;
      if (req.query.action) filters.action = req.query.action as string;
      if (req.query.startDate) filters.startDate = req.query.startDate as string;
      if (req.query.endDate) filters.endDate = req.query.endDate as string;

      const result = await AuditLogsService.getAll(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
  }
}
