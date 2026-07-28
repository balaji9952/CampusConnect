import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Server as HttpServer } from 'http';
import prisma from '../utils/prisma';

export class SocketService {
  private static io: SocketIOServer;
  private static isInitialized = false;

  public static initialize(server: HttpServer): void {
    if (this.isInitialized) return;

    // Reuse the same CORS_ORIGIN env variable that controls HTTP CORS.
    // Parses a comma-separated list; falls back to '*' if not set (dev-friendly).
    const rawOrigin = process.env.CORS_ORIGIN || '';
    const allowedOrigins = rawOrigin
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const socketCorsOrigin: string | string[] = allowedOrigins.length > 0 ? allowedOrigins : '*';

    this.io = new SocketIOServer(server, {
      cors: { origin: socketCorsOrigin, credentials: true }
    });

    this.io.use(async (socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      try {
        const secret = process.env.JWT_SECRET!;
        const issuer = process.env.JWT_ISSUER || 'CampusConnect';
        const audience = process.env.JWT_AUDIENCE || 'CampusConnectApp';
        const user = jwt.verify(token, secret, { issuer, audience }) as any;

        if (user.sessionId) {
          const session = await prisma.user_sessions.findUnique({ where: { id: user.sessionId } });
          if (!session || session.is_revoked) {
            return next(new Error('Authentication error: Session invalid'));
          }
        }

        (socket as any).user = user;
        next();
      } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user;
      console.log(`[Socket] User connected: ${user.id} (${user.role})`);

      // 1. Join user-specific room
      socket.join(`student_${user.id}`);

      // 2. Join role-specific room
      const userRoleStr = String(user.role || '').toLowerCase();
      if (userRoleStr === 'staff' || userRoleStr === 'hostel_manager' || userRoleStr === 'boys_hostel_manager' || userRoleStr === 'girls_hostel_manager' || userRoleStr === 'food_manager') {
        socket.join('staff');
      } else if (userRoleStr === 'admin') {
        socket.join('admin');
      }

      // 3. Join department-specific room if applicable
      if (user.department_id) {
        socket.join(`department_${user.department_id}`);
      }

      // 4. Ticket detail room joining logic
      socket.on('join_ticket', async (ticketId: string) => {
        try {
          const { VisibilityService } = require('./visibility.service');
          const authorizedUsers = await VisibilityService.getUsersWithTicketVisibility(ticketId);

          if (!authorizedUsers.includes(user.id)) {
            console.warn(`[Socket] UNAUTHORIZED: User ${user.id} attempted to join ticket_${ticketId}`);
            socket.emit('error', { message: 'Unauthorized to view this ticket' });
            return;
          }

          socket.join(`ticket_${ticketId}`);
          console.log(`[Socket] User ${user.id} joined ticket room: ticket_${ticketId}`);
        } catch (error) {
          console.error(`[Socket] Error joining ticket room ${ticketId}:`, error);
          socket.emit('error', { message: 'Internal server error while joining ticket' });
        }
      });

      socket.on('leave_ticket', (ticketId: string) => {
        socket.leave(`ticket_${ticketId}`);
        console.log(`[Socket] User ${user.id} left ticket room: ticket_${ticketId}`);
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${user.id}`);
      });
    });

    this.isInitialized = true;
    console.log('[Socket] Socket.IO initialized successfully.');
  }

  /**
   * Broadcast an event to specific rooms
   */
  public static emitToRooms(rooms: string | string[], event: string, payload: any): void {
    if (!this.isInitialized) return;
    this.io.to(rooms).emit(event, payload);
  }

  /**
   * Helper to emit ticket updates intelligently
   */
  public static emitTicketUpdate(
    event: 'ticket_created' | 'ticket_updated' | 'ticket_assigned' | 'ticket_resolved' | 'ticket_escalated',
    ticket: any,
    targetRooms: string[]
  ): void {
    if (!this.isInitialized) return;

    // Always notify users actively viewing this ticket's details
    this.io.to(`ticket_${ticket.id}`).emit(event, ticket);

    // Notify targeted rooms (like creator, assigned staff, admin)
    this.io.to(targetRooms).emit(event, ticket);
  }

  public static emitDashboardDelta(
    targetRooms: string[],
    payload: {
      type: string;
      delta: {
        totalTickets?: number;
        openTickets?: number;
        inProgressTickets?: number;
        resolvedTickets?: number;
        escalatedTickets?: number;
        level1Tickets?: number;
        level2Tickets?: number;
        level3Tickets?: number;
      }
    }
  ): void {
    if (!this.isInitialized) return;
    this.io.to(targetRooms).emit('dashboard_stats_updated', payload);
  }
}
