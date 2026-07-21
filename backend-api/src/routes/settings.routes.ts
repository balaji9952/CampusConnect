import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/escalation', SettingsController.getEscalationSettings);
router.put('/escalation', SettingsController.updateEscalationSettings);

router.get('/security', SettingsController.getSecuritySettings);
router.put('/security', SettingsController.updateSecuritySettings);

export default router;
