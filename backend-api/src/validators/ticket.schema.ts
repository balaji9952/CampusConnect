import { z } from 'zod';

const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" }).optional();

export const CreateTicketSchema = z.object({
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().min(1).max(2000),
  location_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  ticket_type: z.enum(['COMPLAINT', 'PARENT_FEEDBACK']).optional().default('COMPLAINT'),
  priority: z.coerce.number().int().min(1).max(3).optional(),
  qr_verification_token: z.string().uuid('qr_verification_token must be a valid UUID').optional(),
});

export const TicketQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  status: z.coerce.number().int().optional(),
  priority: z.coerce.number().int().min(1).max(3).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  location_id: z.coerce.number().int().positive().optional(),
  creator_role: z.string().optional(),  // e.g. 'Parent', 'Student', 'Staff'
  ticket_type: z.string().optional(),
  startDate: dateSchema,
  endDate: dateSchema
});

export const UpdateTicketSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  location_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  priority: z.coerce.number().int().min(1).max(3).optional(),
  status: z.coerce.number().int().optional(),
  assigned_to_name: z.string().max(150).optional(),
  remarks: z.string().max(2000).optional()
});
