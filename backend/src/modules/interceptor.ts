import { z } from 'zod';
import type { InterceptorPayload } from '../types.js';

const payloadSchema = z.object({
  wallet: z.string().min(32).max(44),
  transaction: z.string().min(1),
  type: z.enum(['signTransaction', 'signMessage']),
  scenario: z.enum(['drainer', 'unlimited_approval', 'fake_token', 'safe']).optional(),
});

export function parseInterceptorPayload(input: unknown): InterceptorPayload {
  return payloadSchema.parse(input);
}
