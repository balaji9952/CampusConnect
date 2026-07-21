import { Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { SettingsService } from '../services/settings.service';

const ESCALATION_SETTINGS_KEY = 'escalation_settings';
const DASHBOARD_SETTINGS_KEY = 'dashboard_settings';

// Zod schemas
const EscalationSettingsSchema = z.object({
  sla: z.object({
    l1: z.number().min(1),
    l2: z.number().min(1),
    l3: z.number().min(1)
  }),
  autoEscalate: z.boolean(),
  chains: z.object({
    dept: z.array(z.string()),
    global: z.array(z.string())
  })
});

function hasAdminAccess(req: AuthRequest): boolean {
  const role = req.user?.role;
  return role === 'Admin' || role === 'Super Admin' || role === 3;
}

const SecuritySettingsSchema = z.object({
  minPasswordLength: z.number().min(6).max(32),
  maxLoginAttempts: z.number().min(3).max(10),
  sessionTimeout: z.number().min(5),
  requireUppercase: z.boolean(),
  requireNumbers: z.boolean(),
  requireSpecial: z.boolean(),
  enable2FA: z.boolean(),
  twoFactorMethod: z.string()
});

export class SettingsController {
  
  // --- Escalation Settings ---

  static async getEscalationSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!hasAdminAccess(req)) {
        res.status(403).json({ success: false, message: 'Insufficient permissions' });
        return;
      }

      const settings = await SettingsService.getSetting(ESCALATION_SETTINGS_KEY);
      if (!settings) {
        res.json({
          success: true,
          data: {
            sla: { l1: 24, l2: 48, l3: 72 },
            autoEscalate: false,
            chains: {
              dept: ['HOD', 'PRINCIPAL', 'ADMIN'],
              global: ['GLOBAL_HEAD', 'ESTATE_OFFICER', 'ADMIN']
            }
          }
        });
        return;
      }
      
      // Handle legacy wrapped format if it exists in DB
      const dataToReturn = settings.settings ? settings.settings : settings;
      res.json({ success: true, data: dataToReturn });
    } catch (error) {
      console.error('Error fetching escalation settings:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async updateEscalationSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!hasAdminAccess(req)) {
        res.status(403).json({ success: false, message: 'Insufficient permissions' });
        return;
      }

      const validatedSettings = EscalationSettingsSchema.parse(req.body);
      
      const payload = validatedSettings;

      const userId = req.user?.id || 'System';
      const userName = req.user?.name || 'Unknown';
      const userRole = req.user?.role || 'Unknown';

      await SettingsService.setSetting(
        ESCALATION_SETTINGS_KEY, 
        payload, 
        userId, userName, userRole, 
        'Updated escalation configuration'
      );

      res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, message: 'Invalid payload structure', errors: error.issues });
        return;
      }
      console.error('Error updating escalation settings:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // --- Security Settings ---

  static async getSecuritySettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!hasAdminAccess(req)) {
        res.status(403).json({ success: false, message: 'Insufficient permissions' });
        return;
      }

      const data = await SettingsService.getSetting('security_settings');
      if (!data) {
        res.json({
          success: true,
          data: {
            version: 1,
            settings: {
              minPasswordLength: 8,
              maxLoginAttempts: 5,
              sessionTimeout: 30,
              requireUppercase: true,
              requireNumbers: true,
              requireSpecial: false,
              enable2FA: false,
              twoFactorMethod: 'Email OTP'
            }
          }
        });
        return;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error fetching security settings:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async updateSecuritySettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!hasAdminAccess(req)) {
        res.status(403).json({ success: false, message: 'Insufficient permissions' });
        return;
      }

      const validatedSettings = SecuritySettingsSchema.parse(req.body);
      const payload = {
        version: 1,
        settings: validatedSettings
      };

      const userId = req.user?.id || 'System';
      const userName = req.user?.name || 'Unknown';
      const userRole = req.user?.role || 'Unknown';

      await SettingsService.setSetting(
        'security_settings', 
        payload, 
        userId, userName, userRole, 
        'Updated security settings'
      );

      await prisma.audit_logs.create({
        data: {
          user_id: userId,
          user_name: userName,
          user_role: userRole,
          action: "SECURITY_SETTINGS_UPDATED",
          entity_type: "settings",
          entity_id: "security_settings",
          description: "Updated global security settings"
        }
      });

      res.json({ success: true, message: 'Security settings updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, message: 'Invalid payload structure', errors: error.issues });
        return;
      }
      console.error('Error updating security settings:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
