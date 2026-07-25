import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const loginRequestSchema = z.object({
  username: z.string().trim().min(2).max(40),
});

export const loginResponseSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  hasPaymentMethod: z.boolean(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const paymentSourceRequestSchema = z.object({
  userId: z.string().min(1),
  token: z.string().startsWith('tkn_'),
});

export const paymentSourceResponseSchema = z.object({
  sourceId: z.string().startsWith('src_'),
});

export const checkoutConfirmationSchema = z.object({
  quoteId: z.string().min(1),
  confirmed: z.literal(true),
});

export type CheckoutConfirmation = z.infer<typeof checkoutConfirmationSchema>;

export const agentRequestSchema = z.object({
  userId: z.string().min(1),
  request: z.string().trim().min(1),
  imageBase64: z.string().min(1).optional(),
  checkoutConfirmation: checkoutConfirmationSchema.optional(),
});

export const completedAgentResultSchema = z.object({
  status: z.literal('completed'),
  action: z.enum(['added', 'removed', 'cart']),
  facts: z.record(z.string(), z.unknown()),
});

export const ambiguousAgentResultSchema = z.object({
  status: z.literal('ambiguous'),
  candidates: z.array(
    z.object({
      productId: z.string().min(1),
      name: z.string().min(1),
    }),
  ),
});

export const quoteAgentResultSchema = z.object({
  status: z.literal('needs_confirmation'),
  quoteId: z.string().min(1),
  items: z.array(cartItemSchema),
  totalCents: z.number().int().nonnegative(),
});

export const paidAgentResultSchema = z.object({
  status: z.literal('paid'),
  paymentId: z.string().startsWith('pmt_'),
  totalCents: z.number().int().nonnegative(),
});

export const errorAgentResultSchema = z.object({
  status: z.literal('error'),
  reason: z.string().min(1),
});

export const agentResultSchema = z.discriminatedUnion('status', [
  completedAgentResultSchema,
  ambiguousAgentResultSchema,
  quoteAgentResultSchema,
  paidAgentResultSchema,
  errorAgentResultSchema,
]);

export type AgentResult = z.infer<typeof agentResultSchema>;

export const realtimeTokenRequestSchema = z.object({
  userId: z.string().min(1),
});

export const realtimeTokenResponseSchema = z.object({
  value: z.string().startsWith('ek_'),
  expiresAt: z.number().int(),
});

export const orderSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1),
  items: z.array(cartItemSchema),
  totalCents: z.number().int().nonnegative(),
  status: z.literal('paid'),
  checkoutQuoteId: z.string().min(1),
  pinchPaymentId: z.string().startsWith('pmt_'),
  createdAt: z.string().datetime(),
});

export const ordersResponseSchema = z.object({
  orders: z.array(orderSchema),
});

export type Order = z.infer<typeof orderSchema>;

export const apiErrorSchema = z.object({
  error: z.string().min(1),
});
