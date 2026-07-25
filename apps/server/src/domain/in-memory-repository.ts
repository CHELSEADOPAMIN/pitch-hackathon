import type { ShoppingRepository } from "./repository.js";
import type { Cart, Order, Product, User } from "./types.js";

type Seed = {
  products?: Product[];
  users?: User[];
  carts?: Cart[];
  orders?: Order[];
};

export const createInMemoryShoppingRepository = (
  seed: Seed = {},
): ShoppingRepository => {
  const products = new Map(
    seed.products?.map((product) => [product.id, product]),
  );
  const users = new Map(seed.users?.map((user) => [user.id, user]));
  const usernames = new Map(
    seed.users?.map((user) => [user.username, user.id]),
  );
  const carts = new Map(seed.carts?.map((cart) => [cart.userId, cart]));
  const orders = new Map(
    seed.orders?.map((order) => [order.checkoutQuoteId, order]),
  );

  return {
    async findProduct(productId) {
      return products.get(productId);
    },
    async searchProducts(query) {
      const needle = query.trim().toLocaleLowerCase();
      return [...products.values()]
        .filter((product) =>
          `${product.name} ${product.description}`
            .toLocaleLowerCase()
            .includes(needle),
        )
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((product) => structuredClone(product));
    },
    async findUser(userId) {
      return users.get(userId);
    },
    async upsertUser(user) {
      const existingId = usernames.get(user.username);
      if (existingId) return structuredClone(users.get(existingId)!);
      users.set(user.id, structuredClone(user));
      usernames.set(user.username, user.id);
      return structuredClone(user);
    },
    async setPayerId(userId, payerId) {
      const user = users.get(userId);
      if (!user) throw new Error("user_not_found");
      const updated = { ...user, pinchPayerId: payerId };
      users.set(userId, updated);
      return structuredClone(updated);
    },
    async setSourceId(userId, sourceId) {
      const user = users.get(userId);
      if (!user) throw new Error("user_not_found");
      const updated = { ...user, pinchSourceId: sourceId };
      users.set(userId, updated);
      return structuredClone(updated);
    },
    async getCart(userId) {
      return structuredClone(carts.get(userId) ?? { userId, items: [] });
    },
    async saveCart(cart) {
      carts.set(cart.userId, structuredClone(cart));
    },
    async createOrderOnce(order) {
      const existing = orders.get(order.checkoutQuoteId);
      if (existing) return structuredClone(existing);
      orders.set(order.checkoutQuoteId, structuredClone(order));
      return structuredClone(order);
    },
    async listOrders() {
      return [...orders.values()]
        .sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        )
        .map((order) => structuredClone(order));
    },
  };
};
