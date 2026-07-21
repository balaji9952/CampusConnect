import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { UsersService } from '../services/users.service';

export class UsersController {
  /**
   * GET /api/users/me
   * Returns the currently authenticated user's profile.
   */
  static async getMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
      }

      const user = await UsersService.getById(userId);
      if (!user) {
        res.status(404).json({ message: 'User not found', success: false });
        return;
      }

      res.status(200).json({ data: user, success: true });
    } catch (error: any) {
      console.error('[UsersController.getMe]', error);
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }

  /**
   * PUT /api/users/me
   * Updates the authenticated user's profile.
   * Accepts: name, programType, branch, studyYear, department, designation
   */
  static async updateMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
      }

      const { name, programType, branch, studyYear, department, designation, email, rollNo } = req.body;

      console.log(`[UsersController.updateMe] Updating user ${userId}:`, req.body);

      const updated = await UsersService.updateProfile(userId, {
        name, programType, branch, studyYear, department, designation, email, rollNo
      });

      console.log(`[UsersController.updateMe] Updated successfully for ${userId}`);
      res.status(200).json({ data: updated, success: true });
    } catch (error: any) {
      console.error('[UsersController.updateMe]', error);
      if (error.message && error.message.includes('Validation error')) {
        res.status(400).json({ message: error.message.replace('Validation error: ', ''), success: false });
        return;
      }
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }

  /**
   * PUT /api/users/me/password
   * Changes the authenticated user's password.
   */
  static async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;

      await UsersService.changePassword(userId, currentPassword, newPassword, confirmPassword);

      res.status(200).json({ message: 'Password updated successfully', success: true });
    } catch (error: any) {
      console.error('[UsersController.changePassword]', error);
      if (error.message && error.message.includes('Validation error')) {
        res.status(400).json({ message: error.message.replace('Validation error: ', ''), success: false });
        return;
      }
      if (error.message === 'Invalid current password' || error.message === 'User not found') {
        res.status(400).json({ message: error.message, success: false });
        return;
      }
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }

  /**
   * POST /api/users/me/photo
   * Accepts a multipart file upload (field name: 'photo').
   * Saves to uploads/profile/ directory and updates users.avatar_url.
   */
  static async uploadPhoto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
      }

      console.log('═══════════════════════════════════════════════════');
      console.log('[UPLOAD RECEIVED] POST /api/users/me/photo hit');
      console.log('[UPLOAD RECEIVED] userId:', userId);
      console.log('[UPLOAD RECEIVED] req.file:', (req as any).file);
      console.log('═══════════════════════════════════════════════════');

      const file = (req as any).file;
      if (!file) {
        console.log('[UPLOAD ERROR] No file found in request');
        res.status(400).json({ message: 'No file uploaded. Use field name: photo', success: false });
        return;
      }

      // Store ONLY the relative path for network-agnostic image resolution
      const photoUrl = `/uploads/profile/${file.filename}`;

      console.log(`[UPLOAD] Saving profile photo: userId=${userId} file=${file.filename} url=${photoUrl}`);

      const updated = await UsersService.updatePhoto(userId, photoUrl);

      console.log(`[UPLOAD] DB updated: avatarUrl=${updated.avatarUrl}`);

      res.status(200).json({
        data: updated,
        success: true,
      });
    } catch (error: any) {
      console.error('[UsersController.uploadPhoto] ERROR:', error);
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }

  /**
   * DELETE /api/users/me/photo
   * Removes the profile photo from the database.
   */
  static async removePhoto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
      }

      console.log(`[UsersController.removePhoto] Removing photo for userId=${userId}`);

      const updated = await UsersService.updatePhoto(userId, null);

      res.status(200).json({
        data: updated,
        success: true,
        message: 'Photo removed successfully'
      });
    } catch (error: any) {
      console.error('[UsersController.removePhoto] ERROR:', error);
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }

  /**
   * POST /api/users/me/verify-password
   */
  static async verifyPassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
      }
      const { password } = req.body;
      if (!password) {
        res.status(400).json({ message: 'Password is required', success: false });
        return;
      }
      const isMatch = await UsersService.verifyPassword(userId, password);
      if (!isMatch) {
        res.status(400).json({ message: 'Incorrect password', success: false });
        return;
      }
      res.status(200).json({ message: 'Password verified', success: true });
    } catch (error: any) {
      console.error('[UsersController.verifyPassword]', error);
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }

  /**
   * GET /api/users/me/preferences
   */
  static async getPreferences(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
      }
      const prefs = await UsersService.getPreferences(userId);
      res.status(200).json({ data: prefs, success: true });
    } catch (error) {
      console.error('[UsersController.getPreferences]', error);
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }

  /**
   * PUT /api/users/me/preferences
   */
  static async updatePreferences(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
      }
      const prefs = await UsersService.updatePreferences(userId, req.body);
      res.status(200).json({ data: prefs, success: true });
    } catch (error) {
      console.error('[UsersController.updatePreferences]', error);
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }
}
