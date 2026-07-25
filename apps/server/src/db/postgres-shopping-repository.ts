import { asc, desc, eq, ilike, or } from "drizzle-orm";

import type { ShoppingRepository } from "../domain/repository.js";
import type { Order, User } from "../domain/types.js";
import type { Database } from "./client.js";
import { carts, orders, products, users } from "./schema.js";

const toUser = (row: typeof users.$inferSelect): User => ({
  id: row.id,
  username: row.username,
  ...(row.pinchPayerId ? { pinchPayerId: row.pinchPayerId } : {}),
  ...(row.pinchSourceId ? { pinchSourceId: row.pinchSourceId } : {}),
});

const toOrder = (row: typeof orders.$inferSelect): Order => ({
  ...row,
  status: "paid",
});

export const createPostgresShoppingRepository = (
  db: Database,
): ShoppingRepository => ({
  async findProduct(productId) {
    return db.query.products.findFirst({ where: eq(products.id, productId) });
  },
  async searchProducts(query) {
    const needle = `%${query.trim()}%`;
    return db
      .select()
      .from(products)
      .where(
        or(ilike(products.name, needle), ilike(products.description, needle)),
      )
      .orderBy(asc(products.name));
  },
  async findUser(userId) {
    const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
    return row ? toUser(row) : undefined;
  },
  async upsertUser(user) {
    const [row] = await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.username,
        set: { username: user.username },
      })
      .returning();
    if (!row) throw new Error("user_upsert_failed");
    return toUser(row);
  },
  async setPayerId(userId, payerId) {
    const [row] = await db
      .update(users)
      .set({ pinchPayerId: payerId })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new Error("user_not_found");
    return toUser(row);
  },
  async setSourceId(userId, sourceId) {
    const [row] = await db
      .update(users)
      .set({ pinchSourceId: sourceId })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new Error("user_not_found");
    return toUser(row);
  },
  async getCart(userId) {
    const row = await db.query.carts.findFirst({
      where: eq(carts.userId, userId),
    });
    return { userId, items: row?.items ?? [] };
  },
  async saveCart(cart) {
    await db
      .insert(carts)
      .values(cart)
      .onConflictDoUpdate({ target: carts.userId, set: { items: cart.items } });
  },
  async createOrderOnce(order) {
    const [created] = await db
      .insert(orders)
      .values(order)
      .onConflictDoNothing({ target: orders.checkoutQuoteId })
      .returning();
    if (created) return toOrder(created);
    const existing = await db.query.orders.findFirst({
      where: eq(orders.checkoutQuoteId, order.checkoutQuoteId),
    });
    if (!existing) throw new Error("order_create_failed");
    return toOrder(existing);
  },
  async listOrders() {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    return rows.map(toOrder);
  },
});
