import type { ShoppingRepository } from '../db/repository';
import type { PinchPaymentGateway } from '../integrations/pinch';
import { InMemoryQuoteStore } from './quote-store';
import type { AgentResult } from './types';
import { DomainError, errorResult } from './types';

export class CheckoutService {
  constructor(
    private readonly repository: ShoppingRepository,
    private readonly quotes: InMemoryQuoteStore,
    private readonly payments: PinchPaymentGateway,
  ) {}

  async prepare(userId: string): Promise<AgentResult> {
    try {
      const cart = await this.repository.getCart(userId);
      const quote = this.quotes.prepare(userId, cart);
      return {
        status: 'needs_confirmation',
        quoteId: quote.id,
        items: quote.items,
        totalCents: quote.totalCents,
      };
    } catch (error) {
      return errorResult(error);
    }
  }

  async confirm(userId: string, quoteId: string): Promise<AgentResult> {
    let claimedQuoteId: string | undefined;
    let paymentApproved = false;

    try {
      const [user, cart] = await Promise.all([
        this.repository.getUser(userId),
        this.repository.getCart(userId),
      ]);
      if (!user) throw new DomainError('user_not_found');
      if (!user.pinchPayerId) throw new DomainError('payment_payer_missing');
      if (!user.pinchSourceId) throw new DomainError('payment_source_missing');

      const claim = this.quotes.claim(userId, quoteId, cart);
      if (claim.kind === 'paid') return claim.result;
      if (claim.kind === 'processing') {
        return { status: 'error', reason: 'checkout_processing' };
      }

      claimedQuoteId = claim.quote.id;
      const payment = await this.payments.charge({
        payerId: user.pinchPayerId,
        sourceId: user.pinchSourceId,
        amountCents: claim.quote.totalCents,
        description: `Checkout ${claim.quote.id}`,
        nonce: `checkout-${claim.quote.id}`,
      });

      if (payment.status !== 'approved') {
        this.quotes.release(claim.quote.id);
        return {
          status: 'error',
          reason: `payment_${payment.status}`,
        };
      }
      paymentApproved = true;

      const paidResult: Extract<AgentResult, { status: 'paid' }> = {
        status: 'paid',
        paymentId: payment.id,
        totalCents: claim.quote.totalCents,
      };

      await this.repository.createOrder({
        userId,
        username: user.username,
        items: claim.quote.items,
        totalCents: claim.quote.totalCents,
        status: 'paid',
        checkoutQuoteId: claim.quote.id,
        pinchPaymentId: payment.id,
      });
      this.quotes.markPaid(claim.quote.id, paidResult);
      return paidResult;
    } catch (error) {
      // If Pinch has approved, keep the quote processing rather than risk a
      // second charge. The PoC deliberately has no durable recovery workflow.
      if (claimedQuoteId && !paymentApproved) {
        this.quotes.release(claimedQuoteId);
      }
      return errorResult(error);
    }
  }
}
