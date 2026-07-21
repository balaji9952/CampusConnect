import { Router } from 'express';
import { AuditLogsController } from '../controllers/audit-logs.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validate.middleware';
import { AuditLogQuerySchema } from '../validators/audit-log.schema';

const router = Router();

router.use(authenticateJWT);

router.get('/', validateQuery(AuditLogQuerySchema), AuditLogsController.getAll);

export default router;
