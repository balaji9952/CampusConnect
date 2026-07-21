import { z } from 'zod';

/**
 * Validates the raw QR code payload sent by the mobile scanner.
 * Enforces: length bounds, valid JSON, required fields with correct types.
 * Rejects malformed payloads before any DB lookup.
 */
export const VerifyQrSchema = z.object({
  body: z.object({
    qrCode: z
      .string()
      .min(1, 'qrCode is required')
      .max(1024, 'qrCode payload too large')
      .refine(
        (val) => {
          const trimmed = val.trim();
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('/scan/')) {
            const parts = trimmed.split('/');
            const token = parts[parts.length - 1];
            return typeof token === 'string' && token.length >= 3;
          }
          try {
            const p = JSON.parse(trimmed);
            return (
              p !== null &&
              typeof p === 'object' &&
              !Array.isArray(p) &&
              'locationId' in p &&
              typeof p.locationId === 'number' &&
              Number.isInteger(p.locationId) &&
              p.locationId > 0 &&
              'token' in p &&
              typeof p.token === 'string' &&
              p.token.length >= 3
            );
          } catch {
            return false;
          }
        },
        {
          message:
            'Invalid QR payload: must be a valid scan URL or JSON with locationId and token',
        }
      ),
  }),
});

export type VerifyQrInput = z.infer<typeof VerifyQrSchema>['body'];
