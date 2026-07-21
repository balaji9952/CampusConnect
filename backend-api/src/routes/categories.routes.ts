import { Router } from 'express';
import { CategoriesController } from '../controllers/categories.controller';

import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Public endpoint — no auth required (Flutter needs it before login for form display)
// Alternatively wrap in authenticateJWT if you want it protected
router.get('/', CategoriesController.getAll);

// Admin endpoints
router.get('/admin', authenticateJWT, CategoriesController.listAdminCategories);
router.post('/', authenticateJWT, CategoriesController.createCategory);
router.put('/:id', authenticateJWT, CategoriesController.updateCategory);
router.delete('/:id', authenticateJWT, CategoriesController.deleteCategory);

export default router;
