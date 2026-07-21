import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { TicketsController } from '../controllers/tickets.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validate.middleware';
import { CreateTicketSchema, TicketQuerySchema, UpdateTicketSchema } from '../validators/ticket.schema';

const router = Router();

// ─── Multer config for ticket photo uploads ──────────────────────────────────
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname);
    cb(null, `ticket-photo-${unique}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /jpeg|jpg|png|webp/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype) || file.mimetype === 'application/octet-stream';
  
  console.log(`[Multer Filter] filename: ${file.originalname}, mimetype: ${file.mimetype}, extOk: ${extOk}, mimeOk: ${mimeOk}`);

  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB max

// Middleware wrapper to catch multer errors and return JSON
const uploadPhotoMiddleware = (req: any, res: any, next: any) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      if (err.message === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ message: 'Only image files (jpg, png, webp) are allowed', success: false });
      }
      return res.status(400).json({ message: err.message, success: false });
    }
    next();
  });
};
// ─────────────────────────────────────────────────────────────────────────────

router.use(authenticateJWT); // Protect all ticket routes

router.get('/', validateQuery(TicketQuerySchema), TicketsController.getAll);
router.get('/:id/escalation-chain', TicketsController.getEscalationChain);
router.get('/:id', TicketsController.getById);
router.post('/', validateBody(CreateTicketSchema), TicketsController.create);
router.put('/:id', validateBody(UpdateTicketSchema), TicketsController.update);
router.patch('/:id/status', validateBody(UpdateTicketSchema), TicketsController.update);
router.patch('/:id/assign', validateBody(UpdateTicketSchema), TicketsController.update);
router.patch('/:id/resolve', validateBody(UpdateTicketSchema), TicketsController.update);
router.put('/:id/archive', TicketsController.archive);
router.post('/:id/photo', uploadPhotoMiddleware, TicketsController.uploadPhoto);

export default router;

