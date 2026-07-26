import { randomUUID } from 'node:crypto';

import { cartTotalCents } from './cart';
import type { AgentResult, CartItem } from './types';
import { DomainError } from './types';

export type CheckoutQuote = {
  id: string;
  userId: string;
  items: CartItem[];
  totalCents: number;
  expiresAt: number;
  status: 'prepared' | 'processing' | 'approved' | 'paid';
  approvedResult?: Extract<AgentResult, { status: 'paid' }>;
  paidResult?: Extract<AgentResult, { status: 'paid' }>;
};

type QuoteClaim =
  | { kind: 'claimed'; quote: CheckoutQuote }
  | { kind: 'processing' }
  | {
      kind: 'approved';
      quote: CheckoutQuote;
      result: Extract<AgentResult, { status: 'paid' }>;
    }
  | {
      kind: 'paid';
      result: Extract<AgentResult, { status: 'paid' }>;
    };

export class InMemoryQuoteStore {
  private readonly quotes = new Map<string, CheckoutQuote>();

  constructor(
    private readonly options: {
      ttlMs?: number;
      now?: () => number;
      createId?: () => string;
    } = {},
  ) {}

  prepare(userId: string, cart: CartItem[]): CheckoutQuote {
    if (cart.length === 0) throw new DomainError('cart_empty');

    const items = cart.map((item) => ({ ...item }));
    const totalCents = cartTotalCents(items);

    const quote: CheckoutQuote = {
      id: this.options.createId?.() ?? `q_${randomUUID()}`,
      userId,
      items,
      totalCents,
      expiresAt:
        (this.options.now?.() ?? Date.now()) +
        (this.options.ttlMs ?? 5 * 60_000),
      status: 'prepared',
    };
    this.quotes.set(quote.id, quote);
    return cloneQuote(quote);
  }

  claim(userId: string, quoteId: string, currentCart: CartItem[]): QuoteClaim {
    const quote = this.quotes.get(quoteId);
    if (!quote) throw new DomainError('quote_not_found');
    if (quote.userId !== userId) throw new DomainError('quote_wrong_user');

    if (quote.status === 'paid' && quote.paidResult) {
      return { kind: 'paid', result: quote.paidResult };
    }
    if (quote.status === 'approved' && quote.approvedResult) {
      return {
        kind: 'approved',
        quote: cloneQuote(quote),
        result: quote.approvedResult,
      };
    }
    if (quote.status === 'processing') return { kind: 'processing' };
    if ((this.options.now?.() ?? Date.now()) >= quote.expiresAt) {
      this.quotes.delete(quoteId);
      throw new DomainError('quote_expired');
    }
    if (cartFingerprint(quote.items) !== cartFingerprint(currentCart)) {
      throw new DomainError('cart_changed');
    }

    // This synchronous state change must happen before the payment request.
    quote.status = 'processing';
    return { kind: 'claimed', quote: cloneQuote(quote) };
  }

  release(quoteId: string) {
    const quote = this.quotes.get(quoteId);
    if (quote?.status === 'processing') quote.status = 'prepared';
  }

  markApproved(
    quoteId: string,
    result: Extract<AgentResult, { status: 'paid' }>,
  ) {
    const quote = this.quotes.get(quoteId);
    if (!quote || quote.status !== 'processing') {
      throw new DomainError('quote_not_processing');
    }
    quote.status = 'approved';
    quote.approvedResult = result;
  }

  markPaid(quoteId: string, result: Extract<AgentResult, { status: 'paid' }>) {
    const quote = this.quotes.get(quoteId);
    if (!quote || quote.status !== 'approved') {
      throw new DomainError('quote_not_approved');
    }
    quote.status = 'paid';
    quote.paidResult = result;
  }

  getForTest(quoteId: string): CheckoutQuote | undefined {
    const quote = this.quotes.get(quoteId);
    return quote ? cloneQuote(quote) : undefined;
  }
}

function cartFingerprint(items: CartItem[]) {
  return JSON.stringify(
    [...items]
      .sort((left, right) => left.productId.localeCompare(right.productId))
      .map(({ productId, name, priceCents, qty }) => ({
        productId,
        name,
        priceCents,
        qty,
      })),
  );
}

function cloneQuote(quote: CheckoutQuote): CheckoutQuote {
  return {
    ...quote,
    items: quote.items.map((item) => ({ ...item })),
    approvedResult: quote.approvedResult
      ? { ...quote.approvedResult }
      : undefined,
    paidResult: quote.paidResult ? { ...quote.paidResult } : undefined,
  };
}
