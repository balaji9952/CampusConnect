import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../utils/prisma';

export class SessionsController {
  
  static async getActiveSessions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const sessions = await prisma.user_sessions.findMany({
        where: {
          user_id: userId,
          is_revoked: false
        },
        orderBy: {
          last_activity: 'desc'
        }
      });

      // Map sessions to hide jwt_id and clearly mark the current session
      const mappedSessions = sessions.map(session => ({
        id: session.id,
        device_name: session.device_name,
        ip_address: session.ip_address,
        last_activity: session.last_activity,
        created_at: session.created_at,
        is_current: session.id === req.user?.sessionId
      }));

      res.json({ success: true, data: mappedSessions });
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async revokeSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const sessionId = req.params.id as string;
      
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Ensure the session belongs to the user
      const session = await prisma.user_sessions.findUnique({
        where: { id: sessionId }
      });

      if (!session || session.user_id !== userId) {
        res.status(404).json({ success: false, message: 'Session not found' });
        return;
      }

      if (session.is_revoked) {
        res.status(400).json({ success: false, message: 'Session is already revoked' });
        return;
      }

      await prisma.user_sessions.update({
        where: { id: sessionId },
        data: { 
          is_revoked: true,
          revoked_at: new Date()
        }
      });

      await prisma.audit_logs.create({
        data: {
          user_id: userId,
          user_name: req.user?.name || 'Unknown',
          user_role: req.user?.role || 'Unknown',
          action: "SESSION_REVOKED",
          entity_type: "session",
          entity_id: sessionId,
          description: `Session revoked by user manually`
        }
      });

      res.json({ success: true, message: 'Session revoked successfully' });
    } catch (error) {
      console.error('Error revoking session:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async revokeAllOtherSessions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const currentSessionId = req.user?.sessionId;

      if (!userId || !currentSessionId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      await prisma.user_sessions.updateMany({
        where: {
          user_id: userId,
          is_revoked: false,
          id: { not: currentSessionId }
        },
        data: {
          is_revoked: true,
          revoked_at: new Date()
        }
      });

      await prisma.audit_logs.create({
        data: {
          user_id: userId,
          user_name: req.user?.name || 'Unknown',
          user_role: req.user?.role || 'Unknown',
          action: "SESSION_REVOKED",
          entity_type: "session",
          entity_id: "ALL_OTHERS",
          description: `All other sessions revoked by user`
        }
      });

      res.json({ success: true, message: 'All other sessions revoked successfully' });
    } catch (error) {
      console.error('Error revoking all other sessions:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
