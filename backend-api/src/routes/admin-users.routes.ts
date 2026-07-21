import { Router } from 'express';
import { AdminUsersController } from '../controllers/admin-users.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// All admin/users routes require a valid JWT
router.use(authenticateJWT);

// ─── Stats (must be BEFORE /:id so it doesn't get captured as an ID param) ───
router.get('/stats', AdminUsersController.getUserStats);

// ─── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/',     AdminUsersController.listUsers);
router.post('/',    AdminUsersController.createUser);
router.put('/:id',  AdminUsersController.updateUser);
router.delete('/:id', AdminUsersController.deleteUser);

export default router;
