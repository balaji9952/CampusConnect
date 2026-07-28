import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import { validateEnv } from './utils/env';

// Global fix: Prisma can return BigInt for aggregate counts; JSON.stringify can't handle it.
// This ensures any BigInt is safely serialized as a Number across all endpoints.
(BigInt.prototype as any).toJSON = function () { return Number(this); };

// Validate startup environment variables
validateEnv();

const app: Express = express();

// ─── Port ─────────────────────────────────────────────────────────────────────
// Always read from environment. Default to 3019 so the value matches the Nginx
// upstream block and PM2/Windows Service configuration documents.
const port = process.env.PORT || 3019;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// CORS_ORIGIN is a comma-separated list of allowed origins defined in .env.
// Examples:
//   Development : CORS_ORIGIN=http://localhost:5500,http://localhost:3000
//   Production  : CORS_ORIGIN=https://admin.company.com,https://exec.company.com
//
// When Nginx is the reverse proxy and the browser talks to the same origin as
// the frontend, CORS restrictions are typically not hit for /api/* routes that
// Nginx proxies. The CORS config here acts as a defence-in-depth layer and
// also covers direct-to-backend traffic (mobile app, WPF desktop tool, Swagger).
const rawCorsOrigin = process.env.CORS_ORIGIN || '';
const allowedOrigins: string[] = rawCorsOrigin
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no Origin header (server-to-server, Postman, mobile apps).
    if (!origin) return callback(null, true);
    // Allow if the origin is in the allowlist, or if no allowlist is configured
    // (empty CORS_ORIGIN means "allow all" — useful for fresh dev setups).
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true,
};

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

app.set('trust proxy', 1);

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

import { performanceMonitorMiddleware, getPerformanceMetrics } from './middleware/perf-monitor';
app.use(performanceMonitorMiddleware);

import authRoutes from './routes/auth.routes';
import ticketsRoutes from './routes/tickets.routes';
import dashboardRoutes from './routes/dashboard.routes';
import notificationsRoutes from './routes/notifications.routes';
import auditLogsRoutes from './routes/audit-logs.routes';
import categoriesRoutes from './routes/categories.routes';
import designationsRoutes from './routes/designations.routes';
import usersRoutes from './routes/users.routes';
import adminUsersRoutes from './routes/admin-users.routes';
import departmentsRoutes from './routes/departments.routes';
import locationsRoutes from './routes/locations.routes';
import globalAssignmentsRoutes from './routes/global-assignments.routes';
import settingsRoutes from './routes/settings.routes';
import escalationAssignmentsRoutes from './routes/escalation-assignments.routes';
import sessionsRoutes from './routes/sessions.routes';
import qrcodesRoutes from './routes/qrcodes.routes';
import { QrcodesController } from './controllers/qrcodes.controller';
import { startCronJobs } from './services/cron.service';
import { initEscalationCron } from './cron/escalation';
import { initReminderCron } from './cron/reminder';
import { initQrSessionCleanupCron } from './cron/qr-session-cleanup';
import { validateRoutingAssignments } from './utils/validate-routing';
import { FCMService } from './services/fcm.service';
import { SocketService } from './services/socket.service';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// Initialize background tasks
// startCronJobs(); // Disabled legacy cron.service in favor of initEscalationCron

// ─── Swagger ──────────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Health Check ─────────────────────────────────────────────────────────────
// Kept at /health so load balancers and orchestrators can poll it.
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/perf-metrics', getPerformanceMetrics);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/designations', designationsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/routing', globalAssignmentsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/global-assignments', globalAssignmentsRoutes);
app.use('/api/admin/escalation-assignments', escalationAssignmentsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/security/sessions', sessionsRoutes);
app.use('/api/qrcodes', qrcodesRoutes);

// ─── QR Scan redirect (public, serves a small HTML page) ──────────────────────
app.get('/scan/:qrNumber', QrcodesController.serveScanForm);

// ─── Uploads ──────────────────────────────────────────────────────────────────
// Serve ticket photos and QR images.
// In production behind Nginx this block is only reached when Nginx has not been
// configured to serve /uploads directly; it is safe to keep for compatibility.
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// NOTE: The /admin static-file route has been intentionally removed.
// The admin-portal and executive-portal are now served exclusively by Nginx
// as static files. The backend exposes ONLY APIs and /uploads.

// ─── Firebase Cloud Messaging ─────────────────────────────────────────────────
FCMService.initialize();

// ─── Cron Jobs ────────────────────────────────────────────────────────────────
initEscalationCron();
initReminderCron();
initQrSessionCleanupCron();

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = app.listen(Number(port), '0.0.0.0', () => {
  const env = process.env.NODE_ENV || 'development';
  const corsDisplay = allowedOrigins.length > 0 ? allowedOrigins.join(', ') : '* (all — set CORS_ORIGIN to restrict)';

  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║        CampusConnect API — Started           ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  ✓ Environment     : ${env.padEnd(23)}║`);
  console.log(`║  ✓ Port            : ${String(port).padEnd(23)}║`);
  console.log(`║  ✓ CORS Origins    : ${corsDisplay.substring(0, 23).padEnd(23)}║`);
  console.log(`║  ✓ Upload Folder   : ${fs.existsSync(uploadsDir) ? 'Ready'.padEnd(23) : 'MISSING'.padEnd(23)}║`);
  console.log(`║  ✓ Swagger Docs    : /api-docs${' '.repeat(14)}║`);
  console.log(`║  ✓ Health Check    : /health${' '.repeat(16)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // Non-blocking startup check: warn if routing assignments are missing
  validateRoutingAssignments().catch((e) =>
    console.error('[STARTUP] Routing validation error:', e)
  );
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
SocketService.initialize(server);