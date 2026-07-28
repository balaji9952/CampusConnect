import { Request, Response } from 'express';
import { AuthService, GoogleAuthError } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.register(req.body);

      if (!result) {
        res.status(400).json({ 
          message: 'Email already registered or invalid request.' 
        });
        return;
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error(error);
      if (error.message?.startsWith('PASSWORD_POLICY:')) {
        res.status(400).json({ 
          success: false, 
          message: error.message.replace('PASSWORD_POLICY: ', '') 
        });
        return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, role, password } = req.body;
      const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';
      const deviceName = req.headers['user-agent'] || 'Unknown Device';

      const result = await AuthService.login(identifier, role, password, ipAddress, deviceName);
      
      if (!result) {
        res.status(401).json({ message: 'Invalid credentials or inactive account.' });
        return;
      }
      
      res.status(200).json(result);
    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.includes('Validation error')) {
        res.status(400).json({ message: error.message.replace('Validation error: ', ''), success: false });
        return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * @deprecated Parent Portal retired. Route now returns 410 Gone.
   * This method is unreachable. Remove in a future cleanup release.
   */
  static async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { credential } = req.body;
      if (!credential) {
        res.status(400).json({ message: 'Missing Google credential' });
        return;
      }
      const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';
      const deviceName = req.headers['user-agent'] || 'Unknown Device';

      const result = await AuthService.googleLogin(credential, ipAddress, deviceName, 2); // 2 = Parent role (parent portal only)
      if (!result) {
        res.status(401).json({ message: 'Google Authentication failed.' });
        return;
      }
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Google login error:', error);
      if (error.message?.startsWith('ACCESS_DENIED')) {
        res.status(403).json({ success: false, message: error.message.replace('ACCESS_DENIED: ', '') });
        return;
      }
      res.status(401).json({ message: error.message || 'Google Authentication failed.', success: false });
    }
  }

  static async mobileGoogleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        res.status(400).json({
          success: false,
          code:    'INVALID_TOKEN',
          message: 'Missing Google ID token.',
        });
        return;
      }

      const ipAddress  = req.ip || req.connection?.remoteAddress || 'Unknown';
      const deviceName = req.headers['user-agent'] || 'Mobile App';

      const result = await AuthService.mobileGoogleLogin(idToken, ipAddress, deviceName);

      if (result.status === 'ACCOUNT_NOT_REGISTERED') {
        // 403 — credentials are valid but this Google account isn't authorized
        // for our system. Structured for the Flutter client to show a friendly
        // "Contact the administrator" screen.
        res.status(403).json({
          success: false,
          code:    'ACCOUNT_NOT_REGISTERED',
          status:  'ACCOUNT_NOT_REGISTERED',
          message: 'Your college account is not registered in the system. Please contact the administrator.',
          profile: result.profile,
        });
        return;
      }

      // status === 'OK'
      res.status(200).json({
        success: true,
        status:  'OK',
        token:   result.token,
        user:    result.user,
      });
    } catch (error: any) {
      if (error instanceof GoogleAuthError) {
        // Map typed error codes to HTTP status + stable JSON `code` field.
        const httpStatus = error.code === 'ACCOUNT_DISABLED' ? 403 : 401;
        console.warn(`[Mobile Google Login] ${error.code}: ${error.message}`);
        res.status(httpStatus).json({
          success: false,
          code:    error.code,
          message: error.message,
        });
        return;
      }
      console.error('[Mobile Google Login] Unexpected error:', error);
      res.status(401).json({
        success: false,
        code:    'INVALID_TOKEN',
        message: 'Google authentication failed.',
      });
    }
  }

  /**
   * POST /api/auth/mobile-google-logout
   * Revokes the current Campus session row (server-side).
   * The Flutter client is responsible for calling GoogleSignIn().signOut()
   * or disconnect() on the device — that's a Google-side concern.
   */
  static async mobileGoogleLogout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const jti    = (req.user as any)?.jti;

      // We tolerate missing jti (older tokens) — still clear what we can.
      if (userId) {
        await AuthService.mobileGoogleLogout(jti || '', userId);
      }

      res.status(200).json({ success: true, message: 'Logged out.' });
    } catch (error: any) {
      console.error('[Mobile Google Logout]', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static getConfig(req: Request, res: Response): void {
    res.status(200).json({
      success: true,
      data: {
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        googleLoginMode: process.env.GOOGLE_LOGIN_MODE || 'popup'
      }
    });
  }
}