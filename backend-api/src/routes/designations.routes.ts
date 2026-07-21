import { Router } from 'express';
import { DesignationsController } from '../controllers/designations.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Admin endpoints — all require authentication
router.get('/', authenticateJWT, DesignationsController.getAll);
router.get('/admin', authenticateJWT, DesignationsController.listAdminDesignations);
router.post('/', authenticateJWT, DesignationsController.create);
router.put('/:name', authenticateJWT, DesignationsController.update);
router.delete('/:name', authenticateJWT, DesignationsController.remove);

export default router;
