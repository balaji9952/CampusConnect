import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { QrcodesService } from '../services/qrcodes.service';
import prisma from '../utils/prisma';

export class QrcodesController {
  /**
   * POST /api/qrcodes
   * Public endpoint used by the WPF Desktop Application to register/sync generated QR codes.
   */
  static async create(req: Request, res: Response): Promise<void> {
    console.log("==================================");
    console.log("QR CREATE API");
    console.log("==================================");
    console.log("Request Body:");
    console.log(req.body);
    console.log("Saving QR...");

    try {
      const { qrNumber, location, block, floor, qrValue, pngPath, pdfPath, internalCode, category, department, routingType, status, qrImageBase64 } = req.body;

      if (!qrNumber || !location || !floor || !qrValue) {
        console.warn("Validation failed: missing required fields", { qrNumber, location, floor, qrValue });
        res.status(400).json({
          success: false,
          message: 'Missing required fields: qrNumber, location, floor, qrValue are all required.'
        });
        return;
      }

      const record = await QrcodesService.create({
        qrNumber,
        location,
        block,
        floor,
        qrValue,
        pngPath: pngPath || '',
        pdfPath: pdfPath || '',
        internalCode: internalCode || '',
        category: category || 'General',
        department: department || 'No Department',
        routingType: routingType || 'Department Routed',
        status: status || 'Active',
        qrImageBase64: qrImageBase64 || ''
      });

      console.log("QR saved successfully");
      console.log("QR generated successfully");
      console.log("Database ID:", record.Id);
      console.log("==================================");

      res.status(201).json({
        success: true,
        data: record,
        message: 'QR Code registered successfully'
      });
    } catch (error: any) {
      console.error('Exception caught in [QrcodesController.create] Error:', error);
      console.log("==================================");
      res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
  }

  /**
   * GET /api/qrcodes
   * Protected endpoint for the Admin Web Portal to list QR codes.
   */
  static async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;

      const list = await QrcodesService.list(search, status);
      res.status(200).json({ success: true, data: list });
    } catch (error: any) {
      console.error('[QrcodesController.list] Error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /api/qrcodes/:id
   * Protected endpoint to get a single QR code.
   */
  static async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid QR Code ID' });
        return;
      }

      const record = await QrcodesService.getById(id);
      if (!record) {
        res.status(404).json({ success: false, message: 'QR Code not found' });
        return;
      }

      res.status(200).json({ success: true, data: record });
    } catch (error: any) {
      console.error('[QrcodesController.getById] Error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * PUT /api/qrcodes/:id
   * Protected endpoint to update a QR code.
   */
  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid QR Code ID' });
        return;
      }

      const record = await QrcodesService.update(id, req.body);
      res.status(200).json({ success: true, data: record, message: 'QR Code updated successfully' });
    } catch (error: any) {
      console.error('[QrcodesController.update] Error:', error);
      res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
  }

  /**
   * DELETE /api/qrcodes/:id
   * Protected endpoint to delete a QR code.
   */
  static async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid QR Code ID' });
        return;
      }

      const deleted = await QrcodesService.delete(id);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'QR Code not found' });
        return;
      }

      res.status(200).json({ success: true, message: 'QR Code deleted successfully' });
    } catch (error: any) {
      console.error('[QrcodesController.delete] Error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * GET /scan/:qrNumber
   * Public endpoint that directs users to use the Campus Connect App.
   */
  static async serveScanForm(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).send(`
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Campus Connect</title>
            <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f2f5; margin: 0; text-align: center; padding: 20px; }
              .container { background: white; padding: 40px 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
              h1 { color: #1A73E8; font-size: 24px; margin-bottom: 16px; }
              p { color: #555; font-size: 16px; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Campus Connect</h1>
              <p>Please scan this QR code using the <strong>Campus Connect App</strong> to register a complaint.</p>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('[QrcodesController.serveScanForm] Error:', error);
      res.status(500).send('Internal server error');
    }
  }
}
