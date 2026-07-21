import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../utils/prisma';
import { NotificationsService } from '../services/notifications.service';

export const registerFcmToken = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { token, deviceId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      console.warn(`[FCM-Register] Rejected: no user ID in JWT. Token prefix: ${(token || '').substring(0, 20)}...`);
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!token) {
      console.warn(`[FCM-Register] Rejected: missing token field. User: ${userId}`);
      res.status(400).json({ success: false, message: 'Token is required' });
      return;
    }

    // Log the attempt
    const existing = await prisma.user_fcm_tokens.findUnique({ where: { token } });
    if (existing) {
      console.log(`[FCM-Register] Token refresh for user ${userId} (device: ${deviceId || 'unknown'}). Previously registered to: ${existing.user_id}`);
    } else {
      console.log(`[FCM-Register] New token for user ${userId} (device: ${deviceId || 'unknown'}). Token prefix: ${token.substring(0, 20)}...`);
    }

    // Upsert the token
    const saved = await prisma.user_fcm_tokens.upsert({
      where: { token: token },
      update: {
        user_id: userId,
        device_id: deviceId,
        updated_at: new Date()
      },
      create: {
        token: token,
        user_id: userId,
        device_id: deviceId
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[FCM-Register] Success: token stored for user ${userId}. Duration: ${duration}ms`);
    res.json({ success: true, message: 'Token registered successfully' });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[FCM-Register] Error after ${duration}ms:`, error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const unregisterFcmToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token, deviceId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!token && !deviceId) {
      res.status(400).json({ success: false, message: 'Token or Device ID is required' });
      return;
    }

    // Delete token by token string or device ID for the specific user
    const deleted = await prisma.user_fcm_tokens.deleteMany({
      where: {
        user_id: userId,
        OR: [
          ...(token ? [{ token }] : []),
          ...(deviceId ? [{ device_id: deviceId }] : [])
        ]
      }
    });

    console.log(`[FCM-Unregister] User ${userId}: deleted ${deleted.count} token(s). Token prefix: ${(token || '').substring(0, 20)}...`);
    res.json({ success: true, message: 'Token unregistered successfully' });
  } catch (error) {
    console.error('Error unregistering FCM token:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'Student'; // 'Admin', 'Staff', or 'Student'

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const notifications = await NotificationsService.getAll(userId, role);
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'Student';
    const notificationId = req.params.id as string;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const updated = await NotificationsService.markAsRead(notificationId, userId, role);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    if (error.message === 'Notification not found') {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }
    if (error.message === 'Forbidden') {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'Student';

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const count = await NotificationsService.getUnreadCount(userId, role);
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
