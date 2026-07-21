import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UsersController } from '../controllers/users.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// ─── Multer config for profile photo uploads ─────────────────────────────────
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'profile');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${unique}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype) || file.mimetype === 'application/octet-stream';
  
  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB max

const uploadProfilePhotoMiddleware = (req: any, res: any, next: any) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      if (err.message === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ message: 'Only image files (jpg, png, gif, webp) are allowed', success: false });
      }
      return res.status(400).json({ message: err.message, success: false });
    }
    next();
  });
};
// ─────────────────────────────────────────────────────────────────────────────

router.use(authenticateJWT); // All /api/users routes require valid JWT

router.get('/me', UsersController.getMe);
router.put('/me', UsersController.updateMe);
router.post('/me/verify-password', UsersController.verifyPassword);
router.put('/me/password', UsersController.changePassword);
router.post('/me/photo', uploadProfilePhotoMiddleware, UsersController.uploadPhoto);
router.delete('/me/photo', UsersController.removePhoto);
router.get('/me/preferences', UsersController.getPreferences);
router.put('/me/preferences', UsersController.updatePreferences);

export default router;
