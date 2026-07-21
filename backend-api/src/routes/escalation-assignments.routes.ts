import { Router } from 'express';
import { EscalationAssignmentsController } from '../controllers/escalation-assignments.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticateJWT);

router.get('/', EscalationAssignmentsController.getAll);
router.put('/', EscalationAssignmentsController.upsert);
router.delete('/:deptId/:level', EscalationAssignmentsController.remove);

export default router;
