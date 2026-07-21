import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../utils/prisma';
import { CategoriesService, ListCategoriesAdminQuery } from '../services/categories.service';
import { isAdminRole } from '../utils/access-control';
import { SimpleCache } from '../utils/cache';

function isAdmin(req: AuthRequest): boolean {
  return isAdminRole(req.user?.role);
}

export class CategoriesController {
  /**
   * GET /api/categories
   * Returns all active complaint categories ordered by sort_order.
   * Used by Flutter to build the dynamic category picker with correct DB IDs.
   */
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cacheKey = 'active_categories';
      const cached = SimpleCache.get<any[]>(cacheKey);
      if (cached) {
        res.status(200).json({ data: cached, success: true });
        return;
      }

      const categories = await prisma.complaint_categories.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
          sort_order: true,
        },
      });

      SimpleCache.set(cacheKey, categories, 300 * 1000); // 5 minutes TTL

      res.status(200).json({ data: categories, success: true });
    } catch (error: any) {
      console.error('[CategoriesController.getAll]', error);
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }

  /**
   * GET /api/categories/admin
   */
  static async listAdminCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const query: ListCategoriesAdminQuery = {
        search: req.query.search as string | undefined,
        page:   req.query.page   as string | undefined,
        limit:  req.query.limit  as string | undefined,
      };

      const result = await CategoriesService.listAdminCategories(query);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      console.error('[CategoriesController.listAdminCategories]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * POST /api/categories
   */
  static async createCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const { name, description, icon, sortOrder, isActive } = req.body;
      const actorName = req.user?.name ?? 'Admin';

      if (!name || !name.trim()) {
        res.status(400).json({ success: false, message: 'name is required' });
        return;
      }

      const parsedSortOrder = parseInt(String(sortOrder), 10);
      if (isNaN(parsedSortOrder)) {
        res.status(400).json({ success: false, message: 'sortOrder is required and must be a number' });
        return;
      }

      const category = await CategoriesService.createCategory(
        { name, description, icon, sortOrder: parsedSortOrder, isActive },
        actorName
      );

      SimpleCache.delete('active_categories');

      res.status(201).json({ success: true, data: category, message: 'Category created successfully' });
    } catch (error: any) {
      if (error.message === 'CATEGORY_NAME_EXISTS') {
        res.status(409).json({ success: false, message: 'A category with this name already exists' });
        return;
      }
      if (error.message === 'INVALID_SORT_ORDER') {
        res.status(400).json({ success: false, message: 'Sort order must be 1 or greater' });
        return;
      }
      console.error('[CategoriesController.createCategory]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * PUT /api/categories/:id
   */
  static async updateCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid category id' });
        return;
      }

      const { name, description, icon, sortOrder, isActive } = req.body;
      const actorName = req.user?.name ?? 'Admin';

      const parsedSortOrder = sortOrder !== undefined ? parseInt(String(sortOrder), 10) : undefined;

      const updated = await CategoriesService.updateCategory(
        id,
        { name, description, icon, sortOrder: parsedSortOrder, isActive },
        actorName
      );

      if (!updated) {
        res.status(404).json({ success: false, message: 'Category not found' });
        return;
      }

      SimpleCache.delete('active_categories');

      res.status(200).json({ success: true, data: updated, message: 'Category updated' });
    } catch (error: any) {
      if (error.message === 'CATEGORY_NAME_EXISTS') {
        res.status(409).json({ success: false, message: 'A category with this name already exists' });
        return;
      }
      if (error.message === 'INVALID_SORT_ORDER') {
        res.status(400).json({ success: false, message: 'Sort order must be 1 or greater' });
        return;
      }
      console.error('[CategoriesController.updateCategory]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/categories/:id
   */
  static async deleteCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid category id' });
        return;
      }

      const actorName = req.user?.name ?? 'Admin';
      const deleted = await CategoriesService.deleteCategory(id, actorName);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Category not found' });
        return;
      }

      SimpleCache.delete('active_categories');

      res.status(200).json({ success: true, message: 'Category softly deleted successfully' });
    } catch (error: any) {
      console.error('[CategoriesController.deleteCategory]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
