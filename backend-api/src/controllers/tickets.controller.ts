import { Response } from 'express';
import path from 'path';
import { AuthRequest } from '../middleware/auth.middleware';
import { TicketsService } from '../services/tickets.service';

export class TicketsController {
  static async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, role } = req.user;
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 1000);
      
      const filters = {
        status: req.query.status ? parseInt(req.query.status as string) : undefined,
        priority: req.query.priority ? parseInt(req.query.priority as string) : undefined,
        category_id: req.query.category_id ? parseInt(req.query.category_id as string) : undefined,
        location_id: req.query.location_id ? parseInt(req.query.location_id as string) : undefined,
        creator_role: req.query.creator_role as string | undefined,
        ticket_type: req.query.ticket_type as string | undefined,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string
      };

      const result = await TicketsService.getAll(id, role, page, limit, filters);
      res.status(200).json({ data: result.data, pagination: result.pagination, success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: userId, role: userRole } = req.user;
      const id = req.params.id as string;
      const ticket = await TicketsService.getById(id, userId, userRole);

      if (!ticket) {
        res.status(404).json({ message: 'Ticket not found', success: false });
        return;
      }

      res.status(200).json({ data: ticket, success: true });
    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message, success: false });
        return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async create(req: AuthRequest, res: Response): Promise<void> {
    const t0 = performance.now();
    try {
      const { id: userId, name: userName, role: userRole, roleLabel } = req.user;
      const { title, description, location_id, category_id, ticket_type, priority, qr_verification_token } = req.body;

      const actualRoleString = String(roleLabel || userRole); // JWT stores 'Staff', 'Student', 'Admin'

      if (!qr_verification_token) {
        res.status(400).json({ message: 'qr_verification_token is required', success: false });
        return;
      }

      const t2 = performance.now();
      const ticket = await TicketsService.create(userId, userName, actualRoleString, {
        title,
        description,
        location_id: location_id ? parseInt(location_id) : undefined,
        category_id: category_id ? parseInt(category_id) : undefined,
        ticket_type: ticket_type || 'COMPLAINT',
        priority: priority ? parseInt(priority) : 1
      }, qr_verification_token);
      
      const t3 = performance.now();
      console.log(`[PROFILE] TicketsService.create total time: ${(t3 - t2).toFixed(2)}ms`);
      console.log(`[PROFILE] Total request time (excluding express parsing): ${(t3 - t0).toFixed(2)}ms`);

      res.status(201).json({ data: ticket, success: true });
    } catch (error: any) {
      console.error('[TicketsController.create] Error:', error);
      if (error.message && error.message.includes('Validation error')) {
        res.status(400).json({ message: 'Validation error', errors: [error.message], success: false });
        return;
      }
      if (error.message === 'VERIFICATION_TOKEN_ALREADY_USED') {
        res.status(403).json({ message: 'Verification token has already been used or has expired. Please scan the QR again.', success: false });
        return;
      }
      if (error.message === 'LOCATION_INACTIVE') {
        res.status(403).json({ message: 'This location has been disabled. Please scan a different QR code.', success: false });
        return;
      }
      if (error.message && error.message.includes('not found')) {
        res.status(400).json({ message: error.message, success: false });
        return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: userId, name: userName, role: userRole } = req.user;
      const ticketId = req.params.id as string;
      const data = req.body;
      
      const ticket = await TicketsService.update(ticketId, userId, userName, userRole, data);
      res.status(200).json({ data: ticket, success: true });
    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message, success: false });
        return;
      }
      if (error.message === 'Ticket not found') {
        res.status(404).json({ message: 'Ticket not found', success: false });
        return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async archive(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: userId, name: userName, role: userRole } = req.user;
      const ticketId = req.params.id as string;
      const ticket = await TicketsService.archive(ticketId, userId, userName, userRole);
      res.status(200).json({ data: ticket, success: true });
    } catch (error: any) {
      console.error(error);
      if (error.message === 'Ticket not found') {
        res.status(404).json({ message: 'Ticket not found', success: false });
        return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * POST /api/tickets/:id/photo
   * Accepts a multipart file upload (field name: 'photo').
   * Saves to uploads/ directory and updates ticket.photo_url + has_photo.
   */
  static async uploadPhoto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ticketId = req.params.id as string;

      // multer attaches the file to req.file
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ message: 'No file uploaded. Use field name: photo', success: false });
        return;
      }

      // Store ONLY the relative path for network-agnostic image resolution
      const photoUrl = `/uploads/${file.filename}`;

      const { id: userId, role: userRole } = req.user;
      const updated = await TicketsService.updatePhoto(ticketId, photoUrl, userId, userRole);

      res.status(200).json({
        data: { photo_url: updated.photo_url, has_photo: updated.has_photo },
        success: true,
      });
    } catch (error: any) {
      console.error('[TicketsController.uploadPhoto] ERROR:', error);
      if (error.message && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message, success: false });
        return;
      }
      if (error.message === 'Ticket not found') {
        res.status(404).json({ message: 'Ticket not found', success: false });
        return;
      }
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }

  static async getEscalationChain(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ticketId = req.params.id as string;
      const chain = await TicketsService.getEscalationChain(ticketId);
      res.status(200).json({ data: chain, success: true });
    } catch (error: any) {
      console.error(error);
      if (error.message === 'Ticket not found') {
        res.status(404).json({ message: 'Ticket not found', success: false });
        return;
      }
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  }
}
