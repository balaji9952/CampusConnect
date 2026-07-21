import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT);

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     description: Returns dashboard stats based on user role (Student vs Staff/Admin)
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard stats successfully retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', DashboardController.getStats);

export default router;
