import { z } from 'zod';

const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" }).optional();

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  user_id: z.string().optional(),
  action: z.string().optional(),
  startDate: dateSchema,
  endDate: dateSchema
});
