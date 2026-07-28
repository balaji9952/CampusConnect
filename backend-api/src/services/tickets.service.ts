import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma';
import { FCMService } from './fcm.service';
import { SocketService } from './socket.service';
import { VisibilityService } from './visibility.service';
import { DesignationsService } from './designations.service';
import { RoutingEngineService } from './routing-engine.service';

export class TicketsService {
  static async getAll(userId: string, role: string, page: number = 1, limit: number = 10, filters: any = {}) {
    const baseWhere = await VisibilityService.getTicketVisibilityWhereClause(userId, role);

    if (baseWhere.id === 'NOT_FOUND' || baseWhere.id === 'UNRECOGNIZED_ROLE') {
      return {
        data: [],
        pagination: { total: 0, page, limit, totalPages: 0 }
      };
    }

    if (filters.status !== undefined && !isNaN(filters.status)) baseWhere.status = filters.status;
    if (filters.priority !== undefined && !isNaN(filters.priority)) baseWhere.priority = filters.priority;
    if (filters.category_id !== undefined && !isNaN(filters.category_id)) baseWhere.category_id = filters.category_id;
    if (filters.location_id !== undefined && !isNaN(filters.location_id)) baseWhere.location_id = filters.location_id;
    if (filters.creator_role) baseWhere.creator_role = filters.creator_role;
    if (filters.ticket_type) baseWhere.ticket_type = filters.ticket_type;

    if (filters.startDate || filters.endDate) {
      baseWhere.created_at = {};
      if (filters.startDate) baseWhere.created_at.gte = new Date(filters.startDate);
      if (filters.endDate) baseWhere.created_at.lte = new Date(filters.endDate);
    }

    // Cap limit to a maximum of 100 to prevent large database queries from exhausting memory
    const cappedLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (page - 1) * cappedLimit;

    const [total, tickets] = await Promise.all([
      prisma.tickets.count({ where: baseWhere }),
      prisma.tickets.findMany({
        where: baseWhere,
        orderBy: { created_at: 'desc' },
        include: { 
          locations: { include: { location_categories: true } }, 
          complaint_categories: true, 
          ticket_updates: true 
        },
        skip,
        take: cappedLimit,
      })
    ]);

    const safeTickets = JSON.parse(JSON.stringify(tickets, (_k, v) =>
      typeof v === 'bigint' ? Number(v) : v
    ));
    const flattenedTickets = safeTickets.map((t: any) => ({
      ...t,
      locationCategoryId: t.locations?.location_categories?.id,
      locationCategoryName: t.locations?.location_categories?.name
    }));

    return {
      data: flattenedTickets,
      pagination: {
        total,
        page,
        limit: cappedLimit,
        totalPages: Math.ceil(total / cappedLimit)
      }
    };
  }

  static async getById(id: string, userId?: string, userRole?: string | number) {
    let whereClause: any = { id, is_deleted: false };

    if (userId && userRole !== undefined) {
      const visibilityWhere = await VisibilityService.getTicketVisibilityWhereClause(userId, userRole);
      if (visibilityWhere.id === 'NOT_FOUND' || visibilityWhere.id === 'UNRECOGNIZED_ROLE') {
        throw new Error('Forbidden: Access denied to this ticket');
      }
      whereClause = { AND: [whereClause, visibilityWhere] };
    }

    const ticket = await prisma.tickets.findFirst({
      where: whereClause,
      include: { 
        locations: { include: { location_categories: true } }, 
        complaint_categories: true, 
        ticket_updates: true 
      },
    });

    if (!ticket) {
      if (userId && userRole !== undefined) {
         // It might exist but be forbidden, so let's check
         const exists = await prisma.tickets.findUnique({ where: { id } });
         if (exists && !exists.is_deleted) throw new Error('Forbidden: Access denied to this ticket');
      }
      return null;
    }

    const safe = JSON.parse(JSON.stringify(ticket, (_k, v) =>
      typeof v === 'bigint' ? Number(v) : v
    ));

    return {
      ...safe,
      locationCategoryId: safe.locations?.location_categories?.id,
      locationCategoryName: safe.locations?.location_categories?.name
    };
  }

  static async create(
    userId: string,
    userName: string,
    userRole: string | number,
    data: {
      title: string;
      description: string;
      location_id?: number;
      category_id?: number;
      ticket_type?: string;
      priority?: number;
    },
    qrVerificationToken?: string
  ) {
    const p_start = performance.now();
    let p_last = p_start;

    if (!data.title || !data.description || !data.location_id || !data.category_id) {
      throw new Error('Validation error: title, description, location_id, and category_id are required');
    }

    console.log('\n--- TEMPORARY DEBUG: QR VERIFICATION ---');
    console.log('verificationToken:', qrVerificationToken);
    console.log('userId:', userId);
    console.log('locationId from request:', data.location_id);
    
    if (qrVerificationToken) {
      const dbSession = await prisma.qr_verification_sessions.findUnique({
        where: { token: qrVerificationToken }
      });
      console.log('Queried Session:', dbSession ? {
        token: dbSession.token,
        user_id: dbSession.user_id,
        location_id: dbSession.location_id,
        used: dbSession.used,
        expires_at: dbSession.expires_at,
      } : 'null');
    } else {
      console.log('Queried Session: Skipped because token is undefined.');
    }
    
    console.log('Executing UPDATE with parameters:');
    console.log(`- token: ${qrVerificationToken}`);
    console.log(`- user_id: ${userId}`);

    // ─── Phase 1 & 2: Extreme Parallel Lookups ──────────
    // We execute ALL reads in a single concurrent block to minimize latency round-trips
    let sessionId: string | null = null;
    let verifiedLocationId: number | null = data.location_id;

    // QR token is always required — atomically consume the session
    const qrPromise = prisma.$queryRaw<any[]>`
        UPDATE qr_verification_sessions 
        SET used = true 
        WHERE token = ${qrVerificationToken} 
          AND user_id = ${userId} 
          AND used = false 
          AND expires_at > ${new Date()}
        RETURNING id, location_id;
      `.then(res => {
         console.log('UPDATE statement affected rows/returned:', res?.length);
         return res;
      });

    const [
      sessions, 
      location, 
      category, 
      creator
    ] = await Promise.all([
      qrPromise,
      prisma.locations.findUnique({ where: { id: data.location_id } }),
      prisma.complaint_categories.findUnique({ where: { id: data.category_id } }),
      prisma.users.findUnique({ where: { id: userId } })
    ]);

    if (!sessions || sessions.length === 0) {
      console.log('QR Validation Failed! Analyzing why...');
      if (qrVerificationToken) {
        const check = await prisma.qr_verification_sessions.findUnique({ where: { token: qrVerificationToken }});
        if (!check) {
          console.log('Reason: Token not found in database.');
        } else if (check.user_id !== userId) {
          console.log(`Reason: user_id mismatch. Expected ${userId}, got ${check.user_id}`);
        } else if (check.used) {
          console.log('Reason: Token is already marked as used = true.');
        } else {
          console.log(`Reason: Token is expired. expires_at=${check.expires_at}, NOW() AT TIME ZONE 'UTC' is past this.`);
        }
      } else {
        console.log('Reason: Token is undefined/missing in request.');
      }
      console.log('----------------------------------------\n');
      throw new Error('VERIFICATION_TOKEN_ALREADY_USED');
    }
    console.log('QR Validation Successful!');
    console.log('----------------------------------------\n');
    sessionId = sessions[0].id;
    verifiedLocationId = sessions[0].location_id;

    if (!location) throw new Error('Location not found');
    if (!category) throw new Error('Category not found');
    
    // Prevent inactive locations from receiving tickets
    if (!location.is_active) {
      throw new Error('LOCATION_INACTIVE');
    }
    
    const p_qr = performance.now();
    console.log(`[PROFILE-SVC] Parallel Lookups (QR + Loc + User + Dept + Routing): ${(p_qr - p_start).toFixed(2)}ms`);

    data.location_id = verifiedLocationId!;

    const ticketId = uuidv4().substring(0, 30); // Max length 30

    // Generate human-readable ticket number: TK-DDMMYY-CATEGORYID-ROLLNO
    const now = new Date();
    const dd  = String(now.getDate()).padStart(2, '0');
    const mm  = String(now.getMonth() + 1).padStart(2, '0');
    const yy  = String(now.getFullYear()).slice(-2);
    const catPart  = String(data.category_id).padStart(2, '0');
    let rollPart = (creator?.roll_no ?? 'UNKNWN').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const ticketNumber = `TK-${dd}${mm}${yy}-${catPart}-${rollPart}-${randomSuffix}`;

    // ─── Routing Resolution ──────────
    const routingEngine = new RoutingEngineService(prisma);
    const assignee = await routingEngine.getAssigneeForLocation(data.location_id, 1, { creator: creator || undefined });
    
    let assignedToName: string = assignee.name;
    let assignedRole: string = assignee.role;
    let assignedUserId: string = assignee.id;
    let assignmentReason: string = 'Initial assignment based on routing rules';
    
    const p_routing = performance.now();
    console.log(`[PROFILE-SVC] Routing Resolution: ${(p_routing - p_qr).toFixed(2)}ms`);

    let newTicket: any;
    let notifications: any[] = [];

    // ─── Phase 3: Batch Database Insert ──────────
    // Uses a batch array transaction to execute all inserts in a single round-trip!
    const txPromises = [];
    
    txPromises.push(prisma.tickets.create({
      data: {
        id: ticketId,
        ticket_number: ticketNumber,
        title: data.title,
        description: data.description,
        location_id: data.location_id!,
        location_name: location.name,
        category_id: data.category_id!,
        category_name: category.name,
        ticket_type: data.ticket_type || 'COMPLAINT',
        priority: data.priority || 1,
        creator_id: userId,
        creator_name: userName,
        creator_role: String(userRole),
        status: 0,
        escalation_level: 1,
        assigned_to_name: assignedToName,
        assigned_role: assignedRole,
      },
    }));

    txPromises.push(prisma.ticket_assignments.create({
      data: {
        ticket_id: ticketId,
        assigned_to_user_id: assignedUserId,
        assigned_by: userId,
        assignment_reason: assignmentReason,
        escalation_level: 1,
        assigned_at: now
      }
    }));

    txPromises.push(prisma.ticket_updates.create({
      data: {
        ticket_id: ticketId,
        message: 'Ticket created',
        update_type: 'creation',
        updated_by: userName,
        user_id: userId,
      },
    }));

    txPromises.push(prisma.audit_logs.create({
      data: {
        user_id: userId,
        user_name: userName,
        user_role: String(userRole),
        action: 'CREATE_TICKET',
        entity_type: 'tickets',
        entity_id: ticketId,
        description: `Created ticket ${ticketId}`,
      },
    }));

    // Removed routingFailure check

    txPromises.push(prisma.audit_logs.create({
      data: {
        user_id:     userId,
        user_name:   userName,
        user_role:   String(userRole),
        action:      'QR_COMPLAINT_CREATED',
        entity_type: 'tickets',
        entity_id:   ticketId,
        new_value:   JSON.stringify({
          verificationSessionId: sessionId,
          ticketId:              ticketId,
          locationId:            verifiedLocationId,
          locationName:          (location as any).name,
        }),
        description: `Ticket ${ticketNumber} created via QR verification at ${(location as any).name}`,
      },
    }));

    const studentNotifData = {
      id: uuidv4(),
      title: 'Ticket Created',
      body: `Your ticket #${ticketNumber} has been submitted successfully.`,
      type: 'TICKET_CREATED',
      ticket_id: ticketId,
      user_id: userId,
    };
    txPromises.push(prisma.notifications.create({ data: studentNotifData }));
    notifications.push(studentNotifData);

    const staffNotifData = {
      id: uuidv4(),
      title: 'New Ticket Assigned',
      body: `Ticket #${ticketNumber} - ${data.title} was assigned to you.`,
      type: 'TICKET_CREATED',
      ticket_id: ticketId,
      user_id: assignedUserId,
      privileged_only: false,
    };
    txPromises.push(prisma.notifications.create({ data: staffNotifData }));
    notifications.push(staffNotifData);

    const hodBroadcastData = {
      id: uuidv4(),
      title: 'New Ticket Created',
      body: `Ticket #${ticketNumber} - ${data.title} was created by ${userName}.`,
      type: 'TICKET_CREATED',
      ticket_id: ticketId,
      user_id: null,
      privileged_only: true,
    };
    txPromises.push(prisma.notifications.create({ data: hodBroadcastData }));
    notifications.push(hodBroadcastData);

    const [createdTicket] = await prisma.$transaction(txPromises);
    newTicket = createdTicket;
    
    const p_tx = performance.now();
    console.log(`[PROFILE-SVC] Database Batch Insert Total: ${(p_tx - p_routing).toFixed(2)}ms`);
    p_last = p_tx;

    // 🚀 Fire Socket.IO live sync 🚀
    const socketRooms = [
      'admin',
      'staff', // Or derive specific staff rooms if needed
      `student_${newTicket.creator_id}`
    ];
    SocketService.emitTicketUpdate('ticket_created', newTicket, socketRooms);
    SocketService.emitDashboardDelta(socketRooms, {
      type: 'ticket_created',
      delta: { totalTickets: 1, openTickets: 1 }
    });

    for (const notif of notifications) {
      if (notif.privileged_only) {
        SocketService.emitToRooms(['staff', 'admin'], 'notification_created', notif);
      } else if (notif.user_id) {
        SocketService.emitToRooms(`student_${notif.user_id}`, 'notification_created', notif);
      }
    }

    // 🚀 Fire FCM pushes AFTER transaction commit (DB-first policy) 🚀
    // Fire and forget so it doesn't block the API response
    VisibilityService.getUsersWithTicketVisibility(newTicket.id).then(authorizedUsers => {
      Promise.all(authorizedUsers.map(pushUserId => {
        if (pushUserId === newTicket.creator_id) {
          return FCMService.sendPushToUser(
            pushUserId,
            'Ticket Created',
            `Your ticket #${newTicket.ticket_number} has been submitted successfully.`,
            { ticketId: newTicket.id },
            'ticket_assignments'
          ).catch(e => console.error(e));
        } else {
          return FCMService.sendPushToUser(
            pushUserId,
            'New Ticket Created',
            `Ticket #${newTicket.ticket_number} requires attention.`,
            { ticketId: newTicket.id },
            'ticket_assignments'
          ).catch(e => console.error(e));
        }
      })).catch(e => console.error('[FCM Async Error]', e));
    }).catch(e => console.error('[Visibility Fetch Error]', e));

    const p_fcm = performance.now();
    console.log(`[PROFILE-SVC] Post-Tx Async FCM/Socket Dispatch: ${(p_fcm - p_last).toFixed(2)}ms`);
    console.log(`[PROFILE-SVC] Service 'create' Total Time: ${(p_fcm - p_start).toFixed(2)}ms`);

    return newTicket;
  }

  static async update(
    id: string,
    userId: string,
    userName: string,
    userRole: string | number,
    data: any
  ) {
    if (VisibilityService.isStudentOrParent(userRole)) {
      throw new Error('Forbidden: Students and Parents cannot update tickets');
    }

    const existingTicket = await this.getById(id, userId, userRole);
    if (!existingTicket) throw new Error('Ticket not found');

    const canModify = await VisibilityService.canModifyTicket(userId, userRole, id);
    if (!canModify) {
      throw new Error('Forbidden: You do not have permission to modify this ticket');
    }

    // ── Deduplication: determine highest-priority event ─────────────────────────
    // Priority: RESOLVED (1) > REOPENED (2) > STATUS_UPDATE (3)
    const isResolution = data.status === 2 && existingTicket.status !== 2;
    const isReopen = data.status !== undefined && data.status !== 2 && existingTicket.status === 2;
    const isStatusUpdate = !isResolution && !isReopen && data.status !== undefined && existingTicket.status !== data.status;
    const isReassignment = Boolean(data.assigned_to_name) && existingTicket.assigned_to_name !== data.assigned_to_name;
    const isRemarkUpdate = Boolean(data.remarks) && !isResolution && !isReopen && !isStatusUpdate && !isReassignment;

    const { ticket: updatedTicket, notifications } = await prisma.$transaction(async (tx) => {
      const collectedNotifications: any[] = [];
      const { remarks, ...ticketData } = data;

      const ticket = await tx.tickets.update({
        where: { id },
        data: {
          ...ticketData,
          updated_at: new Date(),
        },
      });

      await tx.ticket_updates.create({
        data: {
          ticket_id: ticket.id,
          message: remarks ? remarks : 'Ticket updated',
          update_type: isResolution ? 'resolution' : 'update',
          updated_by: userName,
          user_id: userId,
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: userId,
          user_name: userName,
          user_role: String(userRole),
          action: 'UPDATE_TICKET',
          entity_type: 'tickets',
          entity_id: ticket.id,
          description: `Updated ticket ${ticket.id}`,
        },
      });

      // ── PRIORITY 1: Resolution ──────────────────────────────────────────────────
      if (isResolution) {
        const n1 = await tx.notifications.create({
          data: {
            id: uuidv4(),
            user_id: existingTicket.creator_id,
            title: 'Ticket Resolved',
            body: `Your ticket #${ticket.ticket_number} has been resolved.`,
            type: 'TICKET_RESOLVED',
            ticket_id: ticket.id,
          },
        });
        collectedNotifications.push(n1);
      } else if (isReopen) {
      // ── PRIORITY 2: Reopened ────────────────────────────────────────────────────
        const n2 = await tx.notifications.create({
          data: {
            id: uuidv4(),
            user_id: existingTicket.creator_id,
            title: 'Ticket Reopened',
            body: `Your ticket #${ticket.ticket_number} has been reopened.`,
            type: 'TICKET_REOPENED',
            ticket_id: ticket.id,
          },
        });
        collectedNotifications.push(n2);
      } else if (isStatusUpdate) {
      // ── PRIORITY 3: Status Update ───────────────────────────────────────────────
        let statusString = 'Pending';
        if (data.status === 1) statusString = 'In Progress';
        if (data.status === 4) statusString = 'Closed';
        
        const n3 = await tx.notifications.create({
          data: {
            id: uuidv4(),
            user_id: existingTicket.creator_id,
            title: 'Ticket Status Updated',
            body: `Your ticket #${ticket.ticket_number} status changed to ${statusString}.`,
            type: 'TICKET_STATUS_UPDATED',
            ticket_id: ticket.id,
          },
        });
      }

      // ── Reassignment ────────────────────────────────────────────────────────────
      // This happens independently of the status changes.
      if (isReassignment) {
        await tx.ticket_assignments.create({
          data: {
            ticket_id: ticket.id,
            assigned_by: userId,
            assignment_reason: remarks ? `Reassigned: ${remarks}` : 'Manual reassignment',
            escalation_level: ticket.escalation_level,
            assigned_at: new Date()
          }
        });

        // DB notification for student
        const n4 = await tx.notifications.create({
          data: {
            id: uuidv4(),
            user_id: existingTicket.creator_id,
            title: 'Ticket Reassigned',
            body: `Your ticket #${ticket.ticket_number} has been reassigned to ${data.assigned_to_name}.`,
            type: 'TICKET_ASSIGNED',
            ticket_id: ticket.id,
          },
        });
        collectedNotifications.push(n4);

        // DB notification + FCM for new assignee
        const newAssignee = await tx.users.findFirst({ where: { name: data.assigned_to_name } });
        if (newAssignee) {
          const n5 = await tx.notifications.create({
            data: {
              id: uuidv4(),
              user_id: newAssignee.id,
              title: 'Ticket Assigned to You',
              body: `Ticket #${ticket.ticket_number} has been reassigned to you.`,
              type: 'TICKET_ASSIGNED',
              ticket_id: ticket.id,
              privileged_only: true,
            },
          });
          collectedNotifications.push(n5);
        }
      }

      return { ticket, notifications: collectedNotifications };
    });

    // 🚀 Fire FCM pushes AFTER transaction commit (DB-first policy) 🚀
    const authorizedUsers = await VisibilityService.getUsersWithTicketVisibility(updatedTicket.id);

    // 🚀 Fire Socket.IO live sync 🚀
    const socketRooms = [
      'admin',
      'staff', // Or derive specific staff rooms if needed
      `student_${updatedTicket.creator_id}`
    ];

    let socketEvent: 'ticket_resolved' | 'ticket_escalated' | 'ticket_assigned' | 'ticket_updated' = 'ticket_updated';
    let deltaStats: any = {};

    if (isResolution) {
      socketEvent = 'ticket_resolved';
      deltaStats = { totalTickets: 0, openTickets: -1, inProgressTickets: 0, resolvedTickets: 1 };
    } else if (isReassignment) {
      socketEvent = 'ticket_assigned';
    } else if (isStatusUpdate) {
      // Assuming status went to in-progress
      deltaStats = { totalTickets: 0, openTickets: -1, inProgressTickets: 1, resolvedTickets: 0 };
    }

    SocketService.emitTicketUpdate(socketEvent, updatedTicket, socketRooms);
    
    if (Object.keys(deltaStats).length > 0) {
      SocketService.emitDashboardDelta(socketRooms, {
        type: socketEvent,
        delta: deltaStats
      });
    }

    for (const notif of notifications) {
      if (notif.privileged_only) {
        SocketService.emitToRooms(['staff', 'admin'], 'notification_created', notif);
      } else if (notif.user_id) {
        SocketService.emitToRooms(`student_${notif.user_id}`, 'notification_created', notif);
      }
    }

    // Fire and forget FCM pushes so they don't block the API response
    Promise.all(authorizedUsers.map(pushUserId => {
      if (isResolution) {
        return FCMService.sendPushToUser(
          pushUserId,
          'Ticket Resolved',
          `Ticket #${updatedTicket.ticket_number} has been resolved.`,
          { ticketId: updatedTicket.id },
          'resolutions'
        ).catch(e => console.error(e));
      } else if (isReopen) {
        return FCMService.sendPushToUser(
          pushUserId,
          'Ticket Reopened',
          `Ticket #${updatedTicket.ticket_number} has been reopened.`,
          { ticketId: updatedTicket.id },
          'ticket_assignments'
        ).catch(e => console.error(e));
      } else if (isStatusUpdate) {
        let statusString = 'Pending';
        if (data.status === 1) statusString = 'In Progress';
        if (data.status === 4) statusString = 'Closed';
        return FCMService.sendPushToUser(
          pushUserId,
          'Ticket Status Updated',
          `Ticket #${updatedTicket.ticket_number} status changed to ${statusString}.`,
          { ticketId: updatedTicket.id },
          'ticket_assignments'
        ).catch(e => console.error(e));
      } else if (isReassignment) {
        if (pushUserId === updatedTicket.creator_id) {
           return FCMService.sendPushToUser(
             pushUserId,
             'Ticket Reassigned',
             `Your ticket #${updatedTicket.ticket_number} has been reassigned to ${data.assigned_to_name}.`,
             { ticketId: updatedTicket.id },
             'ticket_assignments'
           ).catch(e => console.error(e));
        } else {
           return FCMService.sendPushToUser(
             pushUserId,
             'Ticket Assigned/Reassigned',
             `Ticket #${updatedTicket.ticket_number} has been reassigned to ${data.assigned_to_name}.`,
             { ticketId: updatedTicket.id },
             'ticket_assignments'
           ).catch(e => console.error(e));
        }
      } else if (isRemarkUpdate && pushUserId !== userId) {
         return FCMService.sendPushToUser(
           pushUserId,
           'New Remark on Ticket',
           `Ticket #${updatedTicket.ticket_number} has a new remark.`,
           { ticketId: updatedTicket.id },
           'ticket_assignments'
         ).catch(e => console.error(e));
      }
    })).catch(e => console.error('[FCM Async Error]', e));

    return updatedTicket;
  }

  static async archive(id: string, userId: string, userName: string, userRole: string | number) {
    const existingTicket = await this.getById(id, userId, userRole);
    if (!existingTicket) throw new Error('Ticket not found');

    const canModify = await VisibilityService.canModifyTicket(userId, userRole, id);
    if (!canModify) {
      throw new Error('Forbidden: You do not have permission to archive this ticket');
    }

    const archivedTicket = await prisma.$transaction(async (tx) => {
      const ticket = await tx.tickets.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
        } as any,
      });

      await tx.audit_logs.create({
        data: {
          user_id: userId,
          user_name: userName,
          user_role: String(userRole),
          action: 'ARCHIVE_TICKET',
          entity_type: 'tickets',
          entity_id: ticket.id,
          description: `Ticket Archived`,
        },
      });

      return ticket;
    });

    return archivedTicket;
  }

  /**
   * Updates has_photo and photo_url on a ticket after successful file upload.
   * Called by uploadPhoto controller endpoint.
   */
  static async updatePhoto(ticketId: string, photoUrl: string, userId?: string, userRole?: string | number) {
    const existing = await this.getById(ticketId);
    if (!existing) throw new Error('Ticket not found');

    if (userId && userRole !== undefined) {
      if (VisibilityService.isStudentOrParent(userRole)) {
        if (existing.creator_id !== userId) {
          throw new Error('Forbidden: Cannot upload photos to this ticket');
        }
      } else {
        const canModify = await VisibilityService.canModifyTicket(userId, userRole, ticketId);
        if (!canModify) {
          throw new Error('Forbidden: You do not have permission to upload photos to this ticket');
        }
      }
    }

    const ticket = await prisma.tickets.update({
      where: { id: ticketId },
      data: {
        has_photo: true,
        photo_url: photoUrl,
        updated_at: new Date(),
      },
    });

    const socketRooms = [
      'admin',
      'staff', 
      `student_${ticket.creator_id}`
    ];
    SocketService.emitTicketUpdate('ticket_updated', ticket, socketRooms);

    return ticket;
  }

  /**
   * Returns the full escalation chain for a ticket:
   *  - L1: current assignee + SLA deadline
   *  - L2: next escalation target + when it escalates
   *  - L3: final escalation target + when it escalates
   */
  static async getEscalationChain(ticketId: string) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        complaint_categories: {
          select: { sla_response_hours: true, sla_escalation_hours: true, sla_resolution_hours: true }
        },
        locations: {
          select: { routing_group_id: true, department_id: true }
        },
        ticket_assignments: {
          orderBy: { assigned_at: 'asc' },
        },
      },
    });

    if (!ticket) throw new Error('Ticket not found');

    // ── Load SLA settings ────────────────────────────────────────────────────
    let globalSlaL1 = 24; // hours
    let globalSlaL2 = 48;
    try {
      const setting = await prisma.system_settings.findUnique({ where: { key: 'escalation_settings' } });
      if (setting) {
        const parsed = JSON.parse(setting.value);
        const data = parsed.settings ? parsed.settings : parsed;
        if (data.sla?.l1) globalSlaL1 = data.sla.l1;
        if (data.sla?.l2) globalSlaL2 = data.sla.l2;
      }
    } catch (_) {}

    const slaL1Hours = ticket.complaint_categories?.sla_response_hours || globalSlaL1;
    const slaL2Hours = ticket.complaint_categories?.sla_escalation_hours || globalSlaL2;

    // Find when L1 was assigned (first assignment or ticket creation)
    const l1Assignment = ticket.ticket_assignments.find(a => a.escalation_level === 1);
    const l2Assignment = ticket.ticket_assignments.find(a => a.escalation_level === 2);
    const l1StartTime = l1Assignment?.assigned_at ?? ticket.created_at;
    const l2StartTime = l2Assignment?.assigned_at;

    // Deadline calculation
    const l2EscalatesAt = new Date(l1StartTime.getTime() + slaL1Hours * 3600 * 1000);
    const l3EscalatesAt = l2StartTime
      ? new Date(l2StartTime.getTime() + slaL2Hours * 3600 * 1000)
      : new Date(l2EscalatesAt.getTime() + slaL2Hours * 3600 * 1000);

    const routingGroupId = ticket.locations?.routing_group_id ?? null;
    const locationDeptId = ticket.locations?.department_id ?? null;

    // ── Resolve L2 & L3 targets ──────────────────────────────────────────────
    const resolveTarget = async (level: 2 | 3) => {
      if (routingGroupId) {
        const ga = await prisma.global_assignments.findFirst({
          where: { routing_group_id: routingGroupId, escalation_level: level, is_active: true },
          include: { users: { select: { name: true, designation: true } } },
        });
        if (ga?.users) return { name: ga.users.name, role: ga.users.designation || `Level ${level}` };
      }
      if (locationDeptId) {
        const ea = await prisma.escalation_assignments.findFirst({
          where: { department_id: locationDeptId, escalation_level: level, is_active: true },
          include: { users: { select: { name: true, designation: true } } },
        });
        if (ea?.users) return { name: ea.users.name, role: ea.users.designation || `Level ${level}` };
      }
      return null;
    };

    const [l2Target, l3Target] = await Promise.all([resolveTarget(2), resolveTarget(3)]);

    return {
      currentLevel: ticket.escalation_level,
      status: ticket.status,
      chain: [
        {
          level: 1,
          label: 'Initial Assignee',
          assigneeName: ticket.assigned_to_name ?? 'Unassigned',
          assigneeRole: ticket.assigned_role ?? '',
          isActive: ticket.escalation_level === 1,
          isCompleted: ticket.escalation_level > 1,
          assignedAt: l1StartTime,
          escalatesAt: ticket.escalation_level === 1 ? l2EscalatesAt : null,
          slaHours: slaL1Hours,
        },
        {
          level: 2,
          label: 'Escalation — Level 2',
          assigneeName: l2Assignment
            ? (ticket.assigned_to_name ?? l2Target?.name ?? 'Not assigned')
            : (l2Target?.name ?? 'Not configured'),
          assigneeRole: l2Target?.role ?? 'Level 2',
          isActive: ticket.escalation_level === 2,
          isCompleted: ticket.escalation_level > 2,
          assignedAt: l2StartTime ?? null,
          escalatesAt: ticket.escalation_level === 2 ? l3EscalatesAt : null,
          escalatesAfterHours: slaL2Hours,
          slaHours: slaL2Hours,
          estimatedEscalationAt: ticket.escalation_level <= 1 ? l2EscalatesAt : null,
        },
        {
          level: 3,
          label: 'Final Escalation — Level 3',
          assigneeName: l3Target?.name ?? 'Not configured',
          assigneeRole: l3Target?.role ?? 'Level 3',
          isActive: ticket.escalation_level === 3,
          isCompleted: false,
          assignedAt: ticket.ticket_assignments.find(a => a.escalation_level === 3)?.assigned_at ?? null,
          escalatesAt: null,
          estimatedEscalationAt: ticket.escalation_level <= 2 ? l3EscalatesAt : null,
          slaHours: null,
        },
      ],
    };
  }
}
