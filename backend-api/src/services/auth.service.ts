import prisma from '../utils/prisma';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { generateToken, getRoleString } from '../utils/auth';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Typed errors for the mobile Google SSO flow.
 * The controller maps these to HTTP status + JSON `code` so the
 * Flutter client can branch on a stable contract.
 */
export type GoogleAuthErrorCode =
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'INVALID_DOMAIN'
  | 'ACCOUNT_DISABLED';

export class GoogleAuthError extends Error {
  public readonly code: GoogleAuthErrorCode;
  constructor(code: GoogleAuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'GoogleAuthError';
  }
}

export class AuthService {
  /** Fetch security settings and validate password against configured policy */
  private static async validatePasswordPolicy(password: string): Promise<string | null> {
    // Fetch configured settings; fall back to safe defaults
    let policy = {
      minPasswordLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecial: false
    };

    try {
      const data = await prisma.system_settings.findUnique({ where: { key: 'security_settings' } });
      if (data) {
        const parsed = JSON.parse(data.value);
        const s = parsed.settings || parsed; // Handle both wrapped and flat shapes
        policy = {
          minPasswordLength: s.minPasswordLength ?? 8,
          requireUppercase: s.requireUppercase ?? true,
          requireNumbers: s.requireNumbers ?? true,
          requireSpecial: s.requireSpecial ?? false
        };
      }
    } catch (e) {
      // If settings can't be loaded, use defaults — don't block registration
    }

    if (password.length < policy.minPasswordLength) {
      return `Password must be at least ${policy.minPasswordLength} characters long.`;
    }
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter.';
    }
    if (policy.requireNumbers && !/[0-9]/.test(password)) {
      return 'Password must contain at least one number.';
    }
    if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain at least one special character.';
    }

    return null; // null = valid
  }

  static async register(data: any) {
    const email = data.email.toLowerCase();

    // Validate password against security policy
    const policyError = await AuthService.validatePasswordPolicy(data.password || '');
    if (policyError) {
      throw new Error(`PASSWORD_POLICY: ${policyError}`);
    }

    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) return null;

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const userId = uuidv4();

    let deptId = data.departmentId;
    if (!deptId && data.department) {
      const dept = await prisma.departments.findFirst({ where: { name: data.department } });
      if (dept) deptId = dept.id;
    }

    const user = await prisma.users.create({
      data: {
        id: userId,
        name: data.name.trim(),
        email: email,
        password_hash: hashedPassword,
        role: data.role,
        department_id: deptId,
        roll_no: data.rollNo?.trim(),
        program_type: data.programType,
        branch: data.branch,
        study_year: data.studyYear,
        designation: data.designation,
        is_active: true,
      },
      include: { departments_users_department_idTodepartments: true }
    });

    await prisma.user_notification_preferences.create({
      data: { user_id: user.id }
    });

    await prisma.audit_logs.create({
      data: {
        user_id: user.id,
        user_name: user.name,
        user_role: getRoleString(user.role),
        action: "REGISTER",
        entity_type: "user",
        entity_id: user.id,
        description: `New ${getRoleString(user.role)} registered: ${user.email}`
      }
    });

    return {
      token: generateToken(user),
      user: this.mapToDto(user)
    };
  }

  static async login(identifier?: string, role?: number, password?: string, ipAddress?: string, deviceName?: string) {
    if (!identifier || role === undefined || role === null || !password) {
      throw new Error('Validation error: identifier, role, and password are required.');
    }

    identifier = identifier.trim().toLowerCase();

    const user = await prisma.users.findFirst({
      where: {
        role: role,
        is_active: true,
        OR: [
          { email: identifier },
          { roll_no: identifier }
        ]
      },
      include: { departments_users_department_idTodepartments: true }
    });

    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return null;

    await prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() }
    });

    await prisma.audit_logs.create({
      data: {
        user_id: user.id,
        user_name: user.name,
        user_role: getRoleString(user.role),
        action: "LOGIN",
        entity_type: "user",
        entity_id: user.id,
        description: `User logged in: ${user.email}`
      }
    });

    const sessionId = uuidv4();
    const jti = uuidv4();

    await prisma.user_sessions.create({
      data: {
        id: sessionId,
        user_id: user.id,
        jwt_id: jti,
        device_name: deviceName || 'Unknown Device',
        ip_address: ipAddress || 'Unknown IP'
      }
    });

    await prisma.audit_logs.create({
      data: {
        user_id: user.id,
        user_name: user.name,
        user_role: getRoleString(user.role),
        action: "SESSION_CREATED",
        entity_type: "session",
        entity_id: sessionId,
        description: `New session created from ${ipAddress}`
      }
    });

    return {
      token: generateToken(user, sessionId, jti),
      user: this.mapToDto(user)
    };
  }

  static async googleLogin(credential: string, ipAddress: string, deviceName: string, requiredRole?: number) {
    let user: any;

    // ── Step 1: Verify Google token and find/create user ──────────────────────
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      
      if (!payload || !payload.email_verified) {
        throw new Error('Google account is not verified.');
      }

      const email = payload.email!.toLowerCase();
      
      user = await prisma.users.findUnique({ 
        where: { email },
        include: { departments_users_department_idTodepartments: true }
      });

      if (!user) {
        // Automatically create a parent user if they don't exist
        const userId = uuidv4();
        user = await prisma.users.create({
          data: {
            id: userId,
            name: payload.name || 'Google User',
            email: email,
            password_hash: '', // No password for Google auth
            role: 2, // Parent Role
            is_active: true,
            avatar_url: payload.picture || null,
          },
          include: { departments_users_department_idTodepartments: true }
        });

        await prisma.user_notification_preferences.create({
          data: { user_id: user.id }
        });

        await prisma.audit_logs.create({
          data: {
            user_id: user.id,
            user_name: user.name,
            user_role: getRoleString(user.role),
            action: "REGISTER_GOOGLE",
            entity_type: "user",
            entity_id: user.id,
            description: `New Google Parent registered: ${user.email}`
          }
        });
      }
    } catch (e: any) {
      console.error('VerifyIdToken error:', e);
      throw new Error('Invalid Google credential.');
    }

    // ── Step 2: Portal access check — OUTSIDE the catch so it propagates ──────
    if (!user.is_active) {
      throw new Error('Account is inactive.');
    }

    if (requiredRole !== undefined && user.role !== requiredRole) {
      throw new Error(`ACCESS_DENIED: This email is registered as a ${getRoleString(user.role)}, not a Parent. Please use the correct portal.`);
    }

    // ── Step 3: Create session and return token ───────────────────────────────
    const sessionId = uuidv4();
    const jti = uuidv4();

    await prisma.user_sessions.create({
      data: {
        id: sessionId,
        user_id: user.id,
        jwt_id: jti,
        device_name: deviceName || 'Unknown Device',
        ip_address: ipAddress || 'Unknown IP'
      }
    });

    await prisma.audit_logs.create({
      data: {
        user_id: user.id,
        user_name: user.name,
        user_role: getRoleString(user.role),
        action: "SESSION_CREATED_GOOGLE",
        entity_type: "session",
        entity_id: sessionId,
        description: `New session (Google) created from ${ipAddress}`
      }
    });

    return {
      token: generateToken(user, sessionId, jti),
      user: this.mapToDto(user)
    };
  }

  // ── Mobile SSO: verify Google ID token, enforce domain, find/link user ───────
  static async mobileGoogleLogin(idToken: string, ipAddress: string, deviceName: string): Promise<
    | { status: 'OK'; token: string; user: any }
    | { status: 'ACCOUNT_NOT_REGISTERED'; profile: { name: string; email: string; picture: string | null } }
  > {
    const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN || 'mountzion.ac.in';

    // ── Step 1: Verify the Google ID token ────────────────────────────────────
    // Accept both Web Client ID and Android Client ID as valid audiences
    const audiences = [
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_ANDROID_CLIENT_ID!,
    ].filter(Boolean);

    let payload: any;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: audiences,
      });
      payload = ticket.getPayload();
    } catch (e: any) {
      // Differentiate expired vs malformed so the client can react correctly
      // (Google SDK returns a GaxiosError-like object with `code`/message markers).
      const msg: string = (e?.message || '').toLowerCase();
      if (msg.includes('expired') || msg.includes('exp')) {
        throw new GoogleAuthError('TOKEN_EXPIRED', 'Your Google session has expired. Please sign in again.');
      }
      throw new GoogleAuthError('INVALID_TOKEN', 'Invalid Google credential. Please sign in again.');
    }

    if (!payload) throw new GoogleAuthError('INVALID_TOKEN', 'Empty Google token payload.');
    if (!payload.email_verified) throw new GoogleAuthError('INVALID_TOKEN', 'Your Google account email is not verified.');

    // ── Step 2: Enforce institutional domain ──────────────────────────────────
    const email = payload.email!.toLowerCase();
    const emailDomain = email.split('@')[1];

    if (emailDomain !== allowedDomain) {
      throw new GoogleAuthError(
        'INVALID_DOMAIN',
        `Only @${allowedDomain} accounts are allowed. You signed in with @${emailDomain}.`
      );
    }

    const googleSub   = payload.sub!;
    const googleName  = payload.name || '';
    const googlePic   = payload.picture || null;
    const googleEmail = email;

    // ── Step 3: Find by google_sub (fastest path — returning user) ────────────
    let user = await prisma.users.findFirst({
      where: { google_sub: googleSub },
      include: { departments_users_department_idTodepartments: true },
    });

    if (!user) {
      // ── Step 4: Find by email (first-time Google login) ──────────────────
      user = await prisma.users.findUnique({
        where: { email: googleEmail },
        include: { departments_users_department_idTodepartments: true },
      });

      if (!user) {
        // ── Step 5: Account not registered — reject ───────────────────────
        return {
          status: 'ACCOUNT_NOT_REGISTERED',
          profile: { name: googleName, email: googleEmail, picture: googlePic },
        };
      }

      // ── Step 6: Link Google account to existing user (atomic) ───────────
      // Wrap the link + audit log in a transaction so a concurrent request
      // can't observe a half-linked state. If a parallel request already
      // linked the same sub, the @unique constraint will reject the second
      // write — we treat that as success and re-read the row.
      try {
        const linked = await prisma.$transaction(async (tx) => {
          const updated = await tx.users.update({
            where: { id: user!.id },
            data: {
              google_sub:        googleSub,
              google_email:      googleEmail,
              auth_provider:     'GOOGLE',
              last_google_login: new Date(),
              // Optionally update avatar if user hasn't set one
              avatar_url:        user!.avatar_url || googlePic,
            },
            include: { departments_users_department_idTodepartments: true },
          });

          await tx.audit_logs.create({
            data: {
              user_id:     updated.id,
              user_name:   updated.name,
              user_role:   getRoleString(updated.role),
              action:      'GOOGLE_ACCOUNT_LINKED',
              entity_type: 'user',
              entity_id:   updated.id,
              description: `Google account linked for ${updated.email} (sub: ${googleSub})`,
            },
          });

          return updated;
        });
        user = linked;
      } catch (e: any) {
        // P2002 = unique constraint violation (google_sub already taken).
        // Re-fetch the row that now owns this google_sub — it should be
        // the same user we were going to link, so the login continues.
        const existingBySub = await prisma.users.findFirst({
          where: { google_sub: googleSub },
          include: { departments_users_department_idTodepartments: true },
        });
        if (!existingBySub) throw e; // Unexpected — surface the original error
        user = existingBySub;
      }
    } else {
      // Returning user — just update last_google_login
      await prisma.users.update({
        where: { id: user.id },
        data: { last_google_login: new Date() },
      });
    }

    // ── Step 7: Active check ──────────────────────────────────────────────────
    if (!user.is_active) {
      throw new GoogleAuthError('ACCOUNT_DISABLED', 'Your account has been deactivated. Contact the administrator.');
    }

    // ── Step 8: Create session & return JWT ───────────────────────────────────
    const sessionId = uuidv4();
    const jti       = uuidv4();

    await prisma.user_sessions.create({
      data: {
        id:          sessionId,
        user_id:     user.id,
        jwt_id:      jti,
        device_name: deviceName || 'Mobile App',
        ip_address:  ipAddress  || 'Unknown',
      },
    });

    await prisma.audit_logs.create({
      data: {
        user_id:     user.id,
        user_name:   user.name,
        user_role:   getRoleString(user.role),
        action:      'LOGIN_GOOGLE_MOBILE',
        entity_type: 'session',
        entity_id:   sessionId,
        description: `Mobile Google SSO login from ${ipAddress}`,
      },
    });

    return {
      status: 'OK',
      token:  generateToken(user, sessionId, jti),
      user:   this.mapToDto(user),
    };
  }

  // ── Mobile SSO: revoke Campus session on logout ──────────────────────────────
  static async mobileGoogleLogout(jti: string, userId: string): Promise<void> {
    // Mark the JWT's session row as revoked so the token can't be replayed.
    // We don't actually need to do anything to the Google account server-side —
    // the Flutter client calls GoogleSignIn().signOut() / disconnect() itself.
    if (!jti) return;
    try {
      await prisma.user_sessions.updateMany({
        where: { jwt_id: jti, user_id: userId, is_revoked: false },
        data: { is_revoked: true, revoked_at: new Date() },
      });

      await prisma.audit_logs.create({
        data: {
          user_id:   userId,
          user_name:   null as any,
          user_role:   null as any,
          action:      'LOGOUT_GOOGLE_MOBILE',
          entity_type: 'session',
          entity_id:   jti,
          description: `Mobile Google SSO logout (jti: ${jti})`,
        },
      });
    } catch (e) {
      // Logout must never throw on the client — surface to console only.
      console.error('[AuthService.mobileGoogleLogout]', e);
    }
  }


  private static mapToDto(u: any) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleLabel: getRoleString(u.role),
      departmentId: u.department_id,
      departmentName: u.departments_users_department_idTodepartments?.name,
      rollNo: u.roll_no,
      programType: u.program_type,
      branch: u.branch,
      studyYear: u.study_year,
      designation: u.designation,
      avatarUrl: u.avatar_url,
      createdAt: u.created_at
    };
  }
}
