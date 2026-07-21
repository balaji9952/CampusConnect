import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';
import prisma from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';
export class FCMService {
  private static isInitialized = false;

  public static initialize() {
    if (this.isInitialized) return;
    try {
      if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
      ) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
        this.isInitialized = true;
        console.log('[FCM] Firebase Admin successfully initialized from environment variables');
      } else {
        const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');
        if (fs.existsSync(serviceAccountPath)) {
          initializeApp({
            credential: cert(require(serviceAccountPath))
          });
          this.isInitialized = true;
          console.log('[FCM] Firebase Admin successfully initialized from firebase-service-account.json');
        } else {
          console.warn('[FCM] WARNING: Firebase credentials not found in env or JSON. FCM will not work.');
        }
      }
    } catch (error) {
      console.error('[FCM] Failed to initialize Firebase Admin:', error);
    }
  }

  /**
   * Check if a user has a specific notification preference enabled (opt-out model).
   * Returns true if the preference record doesn't exist (fail-open is intentional for production safety).
   */
  private static async isPreferenceEnabled(
    userId: string,
    prefKey: 'ticket_assignments' | 'escalations' | 'resolutions' | 'reminders' | 'announcements'
  ): Promise<boolean> {
    try {
      const prefs = await prisma.user_notification_preferences.findUnique({
        where: { user_id: userId }
      });
      if (!prefs) return true; // Default: enabled
      return prefs[prefKey] === true;
    } catch {
      return true; // Fail open — never silently drop notifications due to DB issue
    }
  }

  /**
   * Log a failed FCM delivery attempt to audit_logs.
   */
  private static async logFailure(
    userId: string,
    token: string,
    firebaseErrorCode: string,
    notificationType: string
  ): Promise<void> {
    try {
      const tokenShort = token.substring(0, 40); // entity_id is VARCHAR(50)
      const descJson = JSON.stringify({
        userId,
        tokenPrefix: tokenShort,
        firebaseErrorCode,
        notificationType,
        timestamp: new Date().toISOString()
      });
      await prisma.audit_logs.create({
        data: {
          user_id: userId,
          user_name: 'System',
          user_role: 'System',
          action: 'FCM_SEND_FAILED',
          entity_type: 'fcm_token',
          entity_id: tokenShort,           // max 40 chars → fits VARCHAR(50)
          description: descJson.substring(0, 480) // fits VARCHAR(500)
        }
      });
    } catch (logErr) {
      console.error('[FCM] Failed to write audit log for FCM failure:', logErr);
    }
  }

  /**
   * Send a push notification to a specific user.
   * Respects their notification preferences.
   */
  public static async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data: any = {},
    notificationType: 'ticket_assignments' | 'escalations' | 'resolutions' | 'reminders' | 'announcements' = 'announcements'
  ) {
    if (!this.isInitialized) return;

    // Preference check
    const allowed = await this.isPreferenceEnabled(userId, notificationType);
    if (!allowed) {
      console.log(`[FCM] User ${userId} has opted out of '${notificationType}' notifications. Skipping.`);
      return;
    }

    try {
      const userTokens = await prisma.user_fcm_tokens.findMany({
        where: { user_id: userId }
      });

      if (userTokens.length === 0) {
        console.log(`[FCM] User ${userId} has no registered devices`);
        return;
      }

      const tokens = userTokens.map(ut => ut.token);

      const message = {
        notification: { title, body },
        data: {
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
          notification_type: notificationType,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        tokens
      };

      const response = await getMessaging().sendEachForMulticast(message as any);
      console.log(
        `[FCM] User ${userId}: ${response.successCount} delivered, ${response.failureCount} failed`
      );

      // Handle failures: log + remove dead tokens
      if (response.failureCount > 0) {
        const staleTokens: string[] = [];
        await Promise.all(
          response.responses.map(async (resp: any, idx: number) => {
            if (!resp.success && resp.error) {
              const errCode = resp.error.code || 'UNKNOWN';
              const errMsg  = resp.error.message || '';
              // Print exact Firebase error so we can diagnose
              console.error(`[FCM] Token #${idx} FAILED — code: ${errCode}, message: ${errMsg}`);
              await this.logFailure(userId, tokens[idx], errCode, notificationType);

              // Only delete tokens that are definitively invalid/unregistered
              const deadCodes = [
                'messaging/invalid-registration-token',
                'messaging/registration-token-not-registered',
                'messaging/invalid-argument',
                'messaging/mismatched-credential'
              ];
              if (deadCodes.includes(errCode)) {
                staleTokens.push(tokens[idx]);
              }
            }
          })
        );

        if (staleTokens.length > 0) {
          await prisma.user_fcm_tokens.deleteMany({
            where: { token: { in: staleTokens } }
          });
          console.log(`[FCM] Cleaned up ${staleTokens.length} stale tokens for user ${userId}`);
        }
      }
    } catch (error) {
      console.error('[FCM] Error sending push notification:', error);
    }
  }

  /**
   * Broadcast a push notification to all users with a specific role/designation.
   */
  public static async broadcastToRole(
    targetRole: string,
    title: string,
    body: string,
    data: any = {}
  ) {
    if (!this.isInitialized) return;
    try {
      let userIds: string[] = [];

      if (targetRole === 'PRINCIPAL') {
        // Uses the designations table — PRINCIPAL is any privileged designation.
        const allDesignations = await prisma.designations.findMany({
          where: { is_active: true, is_privileged: true },
          select: { name: true }
        });
        const names = allDesignations.map(d => d.name);
        if (names.length > 0) {
          const users = await prisma.users.findMany({ where: { designation: { in: names }, is_active: true } });
          userIds = users.map(u => u.id);
        }
      } else if (targetRole === 'ADMIN') {
        const users = await prisma.users.findMany({ where: { role: { in: [3, 4] }, is_active: true } });
        userIds = users.map(u => u.id);
      } else if (targetRole === 'HOD') {
        // HODs are identified dynamically via the designations table.
        const hodDesignations = await prisma.designations.findMany({
          where: { is_active: true, is_hod: true },
          select: { name: true }
        });
        const hodNames = hodDesignations.map(d => d.name);
        if (hodNames.length > 0) {
          const users = await prisma.users.findMany({ where: { designation: { in: hodNames }, is_active: true } });
          userIds = users.map(u => u.id);
        }
      } else {
        const assignments = await prisma.global_assignments.findMany({
          where: { routing_key: targetRole, is_active: true }
        });
        userIds = assignments.map(a => a.user_id);
      }

      if (userIds.length === 0) return;

      for (const uid of userIds) {
        await this.sendPushToUser(uid, title, body, data, 'ticket_assignments');
      }
    } catch (error) {
      console.error(`[FCM] Error broadcasting to role ${targetRole}:`, error);
    }
  }
}
