import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AdminUsersService, ListUsersQuery } from '../services/admin-users.service';
import { isAdminRole } from '../utils/access-control';

// ─── Guard helper: only Admin (role 3) and Super Admin (role 4) ───────────────
// The JWT payload stores role as a string label (see utils/auth.ts generateToken)
// So we check against string values 'Admin' / 'Super Admin' / 'Staff'
function isAdmin(req: AuthRequest): boolean {
  return isAdminRole(req.user?.role);
}

export class AdminUsersController {
  /**
   * GET /api/admin/users
   * Query params: search, role, status, page, limit
   */
  static async listUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const query: ListUsersQuery = {
        search: req.query.search as string | undefined,
        role:   req.query.role   as string | undefined,
        status: req.query.status as string | undefined,
        page:   req.query.page   as string | undefined,
        limit:  req.query.limit  as string | undefined,
      };

      const result = await AdminUsersService.listUsers(query);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      console.error('[AdminUsersController.listUsers]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /api/admin/users/stats
   * Returns total, active, inactive, staff counts.
   */
  static async getUserStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const stats = await AdminUsersService.getUserStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      console.error('[AdminUsersController.getUserStats]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * POST /api/admin/users
   * Body: { name, email, password, role, departmentId?, ... }
   */
  static async createUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const { name, email, password, role, departmentId,
              rollNo, programType, branch, studyYear, designation, isActive } = req.body;

      // Basic required-field validation
      if (!name || !email || !password || role === undefined) {
        res.status(400).json({
          success: false,
          message: 'name, email, password, and role are required',
        });
        return;
      }

      const roleInt = parseInt(String(role), 10);
      if (isNaN(roleInt) || roleInt < 0 || roleInt > 4) {
        res.status(400).json({ success: false, message: 'role must be 0–4 (Student/Staff/Parent/Admin/SuperAdmin)' });
        return;
      }

      const user = await AdminUsersService.createUser({
        name, email, password,
        role: roleInt,
        departmentId: departmentId ? parseInt(String(departmentId), 10) : null,
        rollNo, programType, branch, studyYear, designation,
        isActive,
      });

      res.status(201).json({ success: true, data: user, message: 'User created successfully' });
    } catch (error: any) {
      if (error.message === 'EMAIL_TAKEN') {
        res.status(409).json({ success: false, message: 'Email is already registered' });
        return;
      }
      if (error.message === 'ROLL_NO_TAKEN') {
        res.status(409).json({ success: false, message: 'ID is already registered for this user type' });
        return;
      }
      console.error('[AdminUsersController.createUser]', error);
      require('fs').appendFileSync('error.log', new Date().toISOString() + ' - CREATE USER ERROR: ' + (error.stack || error.message) + '\nPayload: ' + JSON.stringify(req.body) + '\n\n');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * PUT /api/admin/users/:id
   * Body: any subset of { name, email, role, isActive, departmentId, ... }
   */
  static async updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = String(req.params.id);
      const actorName = req.user?.name ?? 'Admin';

      const { name, email, role, isActive, departmentId,
              rollNo, programType, branch, studyYear, designation } = req.body;

      // Parse role if provided
      let roleInt: number | undefined;
      if (role !== undefined) {
        roleInt = parseInt(String(role), 10);
        if (isNaN(roleInt) || roleInt < 0 || roleInt > 4) {
          res.status(400).json({ success: false, message: 'role must be 0–4' });
          return;
        }
      }

      const updated = await AdminUsersService.updateUser(
        id,
        {
          name, email,
          role: roleInt,
          isActive,
          departmentId: departmentId !== undefined
            ? (departmentId === null ? null : parseInt(String(departmentId), 10))
            : undefined,
          rollNo, programType, branch, studyYear, designation,
        },
        actorName,
      );

      if (!updated) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      res.status(200).json({ success: true, data: updated, message: 'User updated' });
    } catch (error: any) {
      if (error.message === 'EMAIL_TAKEN') {
        res.status(409).json({ success: false, message: 'Email already in use by another user' });
        return;
      }
      if (error.message === 'ROLL_NO_TAKEN') {
        res.status(409).json({ success: false, message: 'ID is already registered for this user type' });
        return;
      }
      console.error('[AdminUsersController.updateUser]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/admin/users/:id   (soft delete)
   */
  static async deleteUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
        return;
      }

      const id = String(req.params.id);
      const actorName = req.user?.name ?? 'Admin';

      // Prevent self-deletion
      if (id === req.user?.id) {
        res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
        return;
      }

      const result = await AdminUsersService.deleteUser(id, actorName);
      if (!result) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      if ((result as any).status === 'deactivated') {
        res.status(200).json({ success: true, message: 'User deactivated successfully' });
      } else {
        res.status(200).json({ success: true, message: 'User completely deleted from database' });
      }
    } catch (error: any) {
      if (error.message === 'HARD_DELETE_FAILED') {
        res.status(409).json({ success: false, message: 'Cannot hard delete this user because they have existing history (tickets, logs, etc).' });
        return;
      }
      console.error('[AdminUsersController.deleteUser]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
