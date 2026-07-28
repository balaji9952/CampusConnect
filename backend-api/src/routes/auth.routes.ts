import { Router } from 'express';
    import { AuthController } from '../controllers/auth.controller';
    import rateLimit from 'express-rate-limit';
    import { authenticateJWT } from '../middleware/auth.middleware';

    const router = Router();

    const isProduction = process.env.NODE_ENV === 'production';

    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: isProduction ? 5 : 1000, // Limit each IP to 5 requests per windowMs in production, 1000 in dev
      message: { message: 'Too many login attempts from this IP, please try again after 15 minutes', success: false }
    });

    const registerLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // Limit each IP to 10 requests per windowMs
      message: { message: 'Too many accounts created from this IP, please try again after an hour', success: false }
    });

    router.post('/register', registerLimiter, AuthController.register);
    router.post('/login', loginLimiter, AuthController.login);
    // Deprecated: Parent Portal retired. Controller/service kept for cleanup release.
    router.post('/google', (req, res) => {
      res.status(410).json({ success: false, message: 'Parent Portal has been retired.' });
    });

    router.post('/mobile-google-login', loginLimiter, AuthController.mobileGoogleLogin);

    // Mobile SSO logout — needs auth so we know whose session to revoke.
    // We deliberately do NOT rate-limit this; logging out must always work.
    router.post('/mobile-google-logout', authenticateJWT, AuthController.mobileGoogleLogout);

    router.get('/config', AuthController.getConfig);

    export default router;
