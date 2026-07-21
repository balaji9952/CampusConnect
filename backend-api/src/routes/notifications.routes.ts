import { Router } from 'express';
import { 
  registerFcmToken, 
  unregisterFcmToken,
  getNotifications,
  markAsRead,
  getUnreadCount
} from '../controllers/notifications.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateJWT, getNotifications);
router.get('/unread-count', authenticateJWT, getUnreadCount);
router.patch('/:id/read', authenticateJWT, markAsRead);

router.post('/fcm-token', authenticateJWT, registerFcmToken);
router.delete('/fcm-token', authenticateJWT, unregisterFcmToken);

export default router;
