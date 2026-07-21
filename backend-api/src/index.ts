import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import { validateEnv } from './utils/env';

// Global fix: Prisma can return BigInt for aggregate counts; JSON.stringify can't handle it.
// This ensures any BigInt is safely serialized as a Number across all endpoints.
(BigInt.prototype as any).toJSON = function () { return Number(this); };

// Validate startup environment variables
validateEnv();

const app: Express = express();
const port = process.env.PORT || 5000;

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

app.set('trust proxy', 1);

app.use(cors());
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

// Setup Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/perf-metrics', getPerformanceMetrics);

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
app.get('/scan/:qrNumber', QrcodesController.serveScanForm);

// Serve static frontend portals for ngrok
app.get('/admin', (req, res) => res.redirect('/admin/login.html'));
app.use('/admin', express.static(path.join(__dirname, '../../admin-portal')));
app.use('/parent', express.static(path.join(__dirname, '../../parent-portal')));

// Serve uploaded ticket photos
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Initialize Firebase Cloud Messaging
FCMService.initialize();

// Initialize Cron Jobs
initEscalationCron();
initReminderCron();
initQrSessionCleanupCron();

const server = app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  // Non-blocking startup check: warn if routing assignments are missing
  validateRoutingAssignments().catch((e) =>
    console.error('[STARTUP] Routing validation error:', e)
  );
});

// Initialize Socket.IO
SocketService.initialize(server);