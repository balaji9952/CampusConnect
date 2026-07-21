import jwt from 'jsonwebtoken';
import { users } from '@prisma/client';

export const getRoleString = (roleNum: number): string => {
  if (roleNum === 1) return 'Staff';
  if (roleNum === 2) return 'Parent';
  if (roleNum === 3) return 'Admin';
  if (roleNum === 4) return 'Super Admin';
  return 'Student'; // Default role 0
};

export const generateToken = (user: users, sessionId?: string, jti?: string) => {
  const payload: any = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: getRoleString(user.role),
    designation: user.designation || ''
  };

  if (sessionId) {
    payload.sessionId = sessionId;
  }

  const secret = process.env.JWT_SECRET!;
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  const issuer = process.env.JWT_ISSUER || 'CampusConnect';
  const audience = process.env.JWT_AUDIENCE || 'CampusConnectApp';

  const signOptions: any = {
    expiresIn: expiresIn as any,
    issuer,
    audience
  };

  if (jti) {
    signOptions.jwtid = jti;
  }

  return jwt.sign(payload, secret, signOptions);
};
