import { z } from 'zod';

export const NotificationParamsSchema = z.object({
  id: z.string().min(1)
});
