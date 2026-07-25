import {
  agentRequestSchema,
  agentResultSchema,
  checkoutConfirmationSchema,
  type AgentResult,
  type CartItem,
  type CheckoutConfirmation,
} from '../../src/contracts/api';
import type { z } from 'zod';

export { agentRequestSchema, agentResultSchema, checkoutConfirmationSchema };
export type { AgentResult, CartItem, CheckoutConfirmation };

export type Product = {
  id: string;
  merchantId: string;
  name: string;
  priceCents: number;
  description: string;
};

export type User = {
  id: string;
  username: string;
  pinchPayerId: string | null;
  pinchSourceId: string | null;
};

export type Order = {
  id: string;
  userId: string;
  username: string;
  items: CartItem[];
  totalCents: number;
  status: 'paid';
  checkoutQuoteId: string;
  pinchPaymentId: string;
  createdAt: Date;
};

export type AgentRequest = z.infer<typeof agentRequestSchema>;

export class DomainError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'DomainError';
  }
}

export function errorResult(error: unknown): AgentResult {
  return {
    status: 'error',
    reason:
      error instanceof DomainError ? error.reason : 'internal_server_error',
  };
}
