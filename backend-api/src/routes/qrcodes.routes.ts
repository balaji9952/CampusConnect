import { Router } from 'express';
import { QrcodesController } from '../controllers/qrcodes.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Public endpoints
router.post('/', QrcodesController.create);

// Protected CRUD endpoints
router.get('/', authenticateJWT, QrcodesController.list);
router.get('/:id', authenticateJWT, QrcodesController.getById);
router.put('/:id', authenticateJWT, QrcodesController.update);
router.delete('/:id', authenticateJWT, QrcodesController.delete);

export default router;
