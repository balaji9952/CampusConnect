import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { DashboardService } from '../services/dashboard.service';

export class DashboardController {
  static async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: userId, role } = req.user;

      if (role === 'Student') {
        const stats = await DashboardService.getStudentStats(userId);
        res.status(200).json({ success: true, data: stats });
        return;
      }

      if (role === 'Staff' || role === 'Admin') {
        const stats = await DashboardService.getStaffAdminStats(userId, role);
        
        console.log("DASHBOARD STATS REQ USER:", req.user);
        let principalData = null;
        if (req.user.designation && req.user.designation.toLowerCase() === 'principal') {
          console.log("FETCHING PRINCIPAL DATA...");
          principalData = await DashboardService.getPrincipalExecutiveReport();
          console.log("PRINCIPAL DATA FETCHED:", principalData !== null);
        }

        res.status(200).json({ 
          success: true, 
          data: {
            ...stats,
            principalExecutiveData: principalData
          }
        });
        return;
      }

      res.status(403).json({ success: false, message: 'Forbidden' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
