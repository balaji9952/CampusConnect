import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Campus Connect API',
      version: '1.0.0',
      description: 'Campus complaint management backend system.',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Authorization: Bearer <token>'
        },
      },
      schemas: {
        Ticket: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            location_id: { type: 'integer' },
            category_id: { type: 'integer' },
            priority: { type: 'integer' },
            status: { type: 'integer' },
            escalation_level: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          }
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            type: { type: 'string' },
            is_read: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          }
        },
        DashboardStats: {
          type: 'object',
          properties: {
            totalTickets: { type: 'integer' },
            openTickets: { type: 'integer' },
            inProgressTickets: { type: 'integer' },
            resolvedTickets: { type: 'integer' },
            escalatedTickets: { type: 'integer' },
          }
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            action: { type: 'string' },
            entity_type: { type: 'string' },
            entity_id: { type: 'string' },
            description: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '201': { description: 'User created' } }
        }
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login a user',
          requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '200': { description: 'Successful login' } }
        }
      },
      '/api/tickets': {
        get: {
          tags: ['Tickets'],
          summary: 'Get all tickets',
          responses: { '200': { description: 'List of tickets', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Ticket' } } } } } }
        },
        post: {
          tags: ['Tickets'],
          summary: 'Create a ticket',
          requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } } },
          responses: { '201': { description: 'Ticket created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } } } }
        }
      },
      '/api/tickets/{id}': {
        get: {
          tags: ['Tickets'],
          summary: 'Get ticket by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Ticket data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } } } }
        },
        put: {
          tags: ['Tickets'],
          summary: 'Update ticket by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } } },
          responses: { '200': { description: 'Ticket updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } } } }
        }
      },
      '/api/tickets/{id}/archive': {
        put: {
          tags: ['Tickets'],
          summary: 'Archive ticket by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Ticket archived', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } } } }
        }
      },
      '/api/dashboard/stats': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get dashboard statistics',
          responses: { '200': { description: 'Dashboard stats', content: { 'application/json': { schema: { $ref: '#/components/schemas/DashboardStats' } } } } }
        }
      },
      '/api/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'Get all notifications',
          responses: { '200': { description: 'List of notifications', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Notification' } } } } } }
        }
      },
      '/api/notifications/unread-count': {
        get: {
          tags: ['Notifications'],
          summary: 'Get unread notification count',
          responses: { '200': { description: 'Unread count' } }
        }
      },
      '/api/notifications/{id}/read': {
        put: {
          tags: ['Notifications'],
          summary: 'Mark notification as read',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Notification marked read' } }
        }
      },
      '/api/audit-logs': {
        get: {
          tags: ['Audit Logs'],
          summary: 'Get all audit logs',
          responses: { '200': { description: 'List of audit logs', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } } } } } }
        }
      }
    }
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
