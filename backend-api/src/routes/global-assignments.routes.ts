import { Router } from 'express';
import { GlobalAssignmentsController } from '../controllers/global-assignments.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/keys', GlobalAssignmentsController.getKeys);
router.get('/assignments', GlobalAssignmentsController.getAssignments);
router.get('/assignments/by-key', GlobalAssignmentsController.getAssignmentsByKey);
router.post('/assignments', GlobalAssignmentsController.reassignKey);
router.get('/metrics', GlobalAssignmentsController.getMetrics);

export default router;
