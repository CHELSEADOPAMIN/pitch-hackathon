import type { PaymentGateway } from "./gateways.js";
import type { ShoppingRepository } from "./repository.js";
import type { AgentResult, CartItem, Payment } from "./types.js";

type Quote = {
  id: string;
  userId: string;
  expiresAt: Date;
  items: CartItem[];
  totalCents: number;
  payment?: Payment;
  confirmation?: Promise<AgentResult>;
};

type Dependencies = {
  repository: ShoppingRepository;
  payments?: PaymentGateway;
  createId: () => string;
  now: () => Date;
};

export interface CheckoutModule {
  prepare(userId: string): Promise<AgentResult>;
  confirm(userId: string, quoteId: string): Promise<AgentResult>;
}

const totalCents = (items: CartItem[]) =>
  items.reduce((total, item) => total + item.priceCents * item.qty, 0);

const normalizeCart = (items: CartItem[]) =>
  [...items]
    .map(({ productId, name, priceCents, qty }) => ({
      productId,
      name,
      priceCents,
      qty,
    }))
    .sort((left, right) => left.productId.localeCompare(right.productId));

const sameCart = (left: CartItem[], right: CartItem[]) =>
  JSON.stringify(normalizeCart(left)) === JSON.stringify(normalizeCart(right));

const paymentFailureReason = (status: string) => {
  if (status === "declined" || status === "dishonoured") {
    return `payment_${status}`;
  }
  if (
    status === "pending" ||
    status === "pending-action" ||
    status === "processing" ||
    status === "scheduled"
  ) {
    return "payment_pending";
  }
  return "payment_not_approved";
};

export const createCheckoutModule = ({
  repository,
  payments,
  createId,
  now,
}: Dependencies): CheckoutModule => {
  const quotes = new Map<string, Quote>();

  const prepare = async (userId: string): Promise<AgentResult> => {
    const [user, cart] = await Promise.all([
      repository.findUser(userId),
      repository.getCart(userId),
    ]);
    if (!user) return { status: "error", reason: "user_not_found" };
    if (cart.items.length === 0)
      return { status: "error", reason: "empty_cart" };

    const quote: Quote = {
      id: createId(),
      userId,
      expiresAt: new Date(now().getTime() + 5 * 60 * 1_000),
      items: structuredClone(cart.items),
      totalCents: totalCents(cart.items),
    };
    quotes.set(quote.id, quote);
    return {
      status: "needs_confirmation",
      quoteId: quote.id,
      expiresAt: quote.expiresAt.toISOString(),
      items: structuredClone(quote.items),
      totalCents: quote.totalCents,
    };
  };

  const confirm = async (
    userId: string,
    quoteId: string,
  ): Promise<AgentResult> => {
    const quote = quotes.get(quoteId);
    if (!quote) return { status: "error", reason: "quote_not_found" };
    if (quote.userId !== userId)
      return { status: "error", reason: "quote_owner_mismatch" };
    if (quote.confirmation) return quote.confirmation;
    if (now().getTime() >= quote.expiresAt.getTime()) {
      return { status: "error", reason: "quote_expired" };
    }

    quote.confirmation = (async (): Promise<AgentResult> => {
      const [user, cart] = await Promise.all([
        repository.findUser(userId),
        repository.getCart(userId),
      ]);
      if (!user) return { status: "error", reason: "user_not_found" };
      if (!sameCart(cart.items, quote.items)) {
        return { status: "error", reason: "cart_changed" };
      }
      if (!user.pinchPayerId || !user.pinchSourceId) {
        return { status: "error", reason: "payment_source_required" };
      }
      if (!payments) return { status: "error", reason: "payments_unavailable" };

      const payment =
        quote.payment ??
        (await payments.charge({
          payerId: user.pinchPayerId,
          sourceId: user.pinchSourceId,
          amount: quote.totalCents,
          description: `Voice shopping order for ${user.username}`,
          nonce: `checkout-${quote.id}`,
        }));
      if (payment.status !== "approved") {
        return {
          status: "error",
          reason: paymentFailureReason(payment.status),
        };
      }
      quote.payment = payment;
      await repository.createOrderOnce({
        id: `order_${quote.id}`,
        userId,
        username: user.username,
        items: structuredClone(quote.items),
        totalCents: quote.totalCents,
        status: "paid",
        checkoutQuoteId: quote.id,
        pinchPaymentId: payment.id,
        createdAt: now(),
      });
      await repository.saveCart({ userId, items: [] });
      return {
        status: "paid",
        paymentId: payment.id,
        totalCents: quote.totalCents,
      };
    })();

    let result: AgentResult;
    try {
      result = await quote.confirmation;
    } catch {
      quote.confirmation = undefined;
      return { status: "error", reason: "checkout_failed" };
    }
    if (result.status === "error" && !quote.payment)
      quote.confirmation = undefined;
    return result;
  };

  return { prepare, confirm };
};
