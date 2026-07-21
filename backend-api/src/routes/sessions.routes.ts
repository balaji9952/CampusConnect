import { Router } from 'express';
import { SessionsController } from '../controllers/sessions.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/', SessionsController.getActiveSessions);
router.post('/revoke-all', SessionsController.revokeAllOtherSessions);
router.post('/:id/revoke', SessionsController.revokeSession);

export default router;
