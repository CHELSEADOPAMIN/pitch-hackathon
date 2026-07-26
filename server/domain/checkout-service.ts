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
      let paidResult: Extract<AgentResult, { status: 'paid' }>;
      if (claim.kind === 'approved') {
        paymentApproved = true;
        paidResult = claim.result;
      } else {
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
            reason: paymentFailureReason(payment.status),
          };
        }
        paymentApproved = true;

        paidResult = {
          status: 'paid',
          paymentId: payment.id,
          totalCents: claim.quote.totalCents,
        };
        this.quotes.markApproved(claim.quote.id, paidResult);
      }

      await this.repository.createOrder({
        userId,
        username: user.username,
        items: claim.quote.items,
        totalCents: claim.quote.totalCents,
        status: 'paid',
        checkoutQuoteId: claim.quote.id,
        pinchPaymentId: paidResult.paymentId,
      });
      await this.repository.clearCart?.(userId);
      this.quotes.markPaid(claim.quote.id, paidResult);
      return paidResult;
    } catch (error) {
      if (claimedQuoteId && !paymentApproved) {
        this.quotes.release(claimedQuoteId);
      }
      return errorResult(error);
    }
  }
}

function paymentFailureReason(status: string) {
  if (status === 'declined' || status === 'dishonoured') {
    return `payment_${status}`;
  }
  if (
    status === 'pending' ||
    status === 'pending-action' ||
    status === 'processing' ||
    status === 'scheduled'
  ) {
    return 'payment_pending';
  }
  return 'payment_not_approved';
}
