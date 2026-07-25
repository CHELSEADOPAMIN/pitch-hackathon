import { createHash } from "node:crypto";

import { createCheckoutModule } from "./checkout.js";
import type { CustomerGateway, PaymentGateway } from "./gateways.js";
import type { ShoppingRepository } from "./repository.js";
import type { AgentResult, CartItem, Order, Product } from "./types.js";

export type LoginResult = {
  userId: string;
  username: string;
  hasPaymentMethod: boolean;
};

export type PaymentSourceResult = {
  userId: string;
  hasPaymentMethod: true;
};

export interface ShoppingDomain {
  login(username: string): Promise<LoginResult>;
  attachPaymentSource(
    userId: string,
    token: string,
  ): Promise<PaymentSourceResult>;
  searchProducts(query: string): Promise<AgentResult>;
  getCatalog(): Promise<Product[]>;
  addToCart(
    userId: string,
    productId: string,
    qty: number,
  ): Promise<AgentResult>;
  removeFromCart(userId: string, productId: string): Promise<AgentResult>;
  getCart(userId: string): Promise<AgentResult>;
  prepareCheckout(userId: string): Promise<AgentResult>;
  confirmCheckout(userId: string, quoteId: string): Promise<AgentResult>;
  listOrders(): Promise<Order[]>;
}

type Dependencies = {
  repository: ShoppingRepository;
  payments?: PaymentGateway;
  customers?: CustomerGateway;
  createId?: () => string;
  now?: () => Date;
};

const totalCents = (items: CartItem[]) =>
  items.reduce((total, item) => total + item.priceCents * item.qty, 0);

const cartFacts = (items: CartItem[]) => ({
  items: structuredClone(items),
  cartCount: items.reduce((count, item) => count + item.qty, 0),
  totalCents: totalCents(items),
});

export const createShoppingDomain = ({
  repository,
  payments,
  customers,
  createId = () => crypto.randomUUID(),
  now = () => new Date(),
}: Dependencies): ShoppingDomain => {
  const checkout = createCheckoutModule({
    repository,
    payments,
    createId,
    now,
  });

  return {
    async login(inputUsername) {
      const username = inputUsername.trim();
      if (!username) throw new Error("invalid_username");
      let user = await repository.upsertUser({ id: createId(), username });
      if (!user.pinchPayerId) {
        if (!customers) throw new Error("customers_unavailable");
        const digest = createHash("sha256")
          .update(username.normalize())
          .digest("hex")
          .slice(0, 16);
        const payer = await customers.createPayer({
          firstName: username,
          emailAddress: `pinch.voice+${digest}@example.com`,
        });
        user = await repository.setPayerId(user.id, payer.id);
      }
      return {
        userId: user.id,
        username: user.username,
        hasPaymentMethod: Boolean(user.pinchSourceId),
      };
    },
    async attachPaymentSource(userId, token) {
      const user = await repository.findUser(userId);
      if (!user) throw new Error("user_not_found");
      if (!user.pinchPayerId) throw new Error("payer_required");
      if (!token.trim()) throw new Error("invalid_payment_token");
      if (!customers) throw new Error("customers_unavailable");
      const source = await customers.attachSource({
        payerId: user.pinchPayerId,
        token,
      });
      await repository.setSourceId(user.id, source.id);
      return { userId: user.id, hasPaymentMethod: true };
    },
    async searchProducts(query) {
      const products = await repository.searchProducts(query);
      if (products.length === 0) {
        return { status: "not_found", entity: "product", query };
      }
      const matches = products.map((product) => ({
        productId: product.id,
        name: product.name,
        priceCents: product.priceCents,
      }));
      if (matches.length > 1)
        return { status: "ambiguous", candidates: matches };
      return {
        status: "completed",
        action: "searched",
        facts: { products: matches },
      };
    },
    getCatalog() {
      return repository.searchProducts("");
    },
    async addToCart(userId, productId, qty) {
      if (!Number.isInteger(qty) || qty < 1) {
        return { status: "error", reason: "invalid_quantity" };
      }

      const [user, product, cart] = await Promise.all([
        repository.findUser(userId),
        repository.findProduct(productId),
        repository.getCart(userId),
      ]);
      if (!user) return { status: "error", reason: "user_not_found" };
      if (!product)
        return { status: "not_found", entity: "product", query: productId };

      const existing = cart.items.find((item) => item.productId === productId);
      const item: CartItem = existing
        ? { ...existing, qty: existing.qty + qty }
        : {
            productId: product.id,
            name: product.name,
            priceCents: product.priceCents,
            qty,
          };
      const items = existing
        ? cart.items.map((entry) =>
            entry.productId === productId ? item : entry,
          )
        : [...cart.items, item];
      await repository.saveCart({ userId, items });

      return {
        status: "completed",
        action: "added",
        facts: {
          cartCount: items.reduce((count, entry) => count + entry.qty, 0),
          item,
          totalCents: totalCents(items),
        },
      };
    },
    prepareCheckout: checkout.prepare,
    async removeFromCart(userId, productId) {
      const [user, cart] = await Promise.all([
        repository.findUser(userId),
        repository.getCart(userId),
      ]);
      if (!user) return { status: "error", reason: "user_not_found" };
      if (!cart.items.some((item) => item.productId === productId)) {
        return { status: "not_found", entity: "product", query: productId };
      }
      const items = cart.items.filter((item) => item.productId !== productId);
      await repository.saveCart({ userId, items });
      const facts = cartFacts(items);
      return {
        status: "completed",
        action: "removed",
        facts: {
          cartCount: facts.cartCount,
          removedProductId: productId,
          totalCents: facts.totalCents,
        },
      };
    },
    async getCart(userId) {
      const [user, cart] = await Promise.all([
        repository.findUser(userId),
        repository.getCart(userId),
      ]);
      if (!user) return { status: "error", reason: "user_not_found" };
      return {
        status: "completed",
        action: "cart",
        facts: cartFacts(cart.items),
      };
    },
    confirmCheckout: checkout.confirm,
    listOrders() {
      return repository.listOrders();
    },
  };
};
