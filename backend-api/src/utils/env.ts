import fs from 'fs';
import path from 'path';

export const validateEnv = () => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
    'DATABASE_URL'
  ];

  const isProduction = process.env.NODE_ENV === 'production';
  const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');
  const hasServiceAccountFile = fs.existsSync(serviceAccountPath);

  if (isProduction || !hasServiceAccountFile) {
    requiredEnvVars.push(
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY'
    );
  }

  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missing.length > 0) {
    throw new Error(`CRITICAL STARTUP FAILURE: Missing required environment variables: ${missing.join(', ')}`);
  }

  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    throw new Error('CRITICAL STARTUP FAILURE: JWT_SECRET must be at least 32 characters long for production security.');
  }

  console.log('[ENV] Environment validation passed successfully.');
};
