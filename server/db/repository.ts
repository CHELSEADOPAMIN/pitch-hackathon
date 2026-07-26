import { desc, eq, ilike, or } from 'drizzle-orm';

import type { CartItem, Order, Product, User } from '../domain/types';
import { DomainError } from '../domain/types';
import { addCartItem, removeCartItem } from '../domain/cart';
import type { Database } from './client';
import { carts, orders, products, users } from './schema';

export type CreateOrderInput = Omit<Order, 'id' | 'createdAt'>;

export interface ShoppingRepository {
  findOrCreateUser(username: string): Promise<User>;
  getUser(userId: string): Promise<User | null>;
  setPinchPayer(userId: string, payerId: string): Promise<User>;
  setPinchSource(userId: string, sourceId: string): Promise<User>;
  listProducts(): Promise<Product[]>;
  searchProducts(query: string): Promise<Product[]>;
  getProduct(productId: string): Promise<Product | null>;
  getCart(userId: string): Promise<CartItem[]>;
  addToCart(
    userId: string,
    productId: string,
    qty: number,
  ): Promise<{ product: Product; cart: CartItem[] }>;
  removeFromCart(
    userId: string,
    productId: string,
  ): Promise<{ removed: CartItem; cart: CartItem[] }>;
  clearCart?(userId: string): Promise<void>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  listOrders(username?: string): Promise<Order[]>;
}

export class DrizzleShoppingRepository implements ShoppingRepository {
  constructor(private readonly db: Database) {}

  async findOrCreateUser(username: string): Promise<User> {
    const [inserted] = await this.db
      .insert(users)
      .values({ username })
      .onConflictDoNothing({ target: users.username })
      .returning();

    if (inserted) return inserted;

    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!existing) throw new DomainError('user_create_failed');
    return existing;
  }

  async getUser(userId: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  }

  async setPinchPayer(userId: string, payerId: string): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set({ pinchPayerId: payerId })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new DomainError('user_not_found');
    return user;
  }

  async setPinchSource(userId: string, sourceId: string): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set({ pinchSourceId: sourceId })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new DomainError('user_not_found');
    return user;
  }

  async listProducts(): Promise<Product[]> {
    return this.db.select().from(products);
  }

  async searchProducts(query: string): Promise<Product[]> {
    const term = query.trim();
    if (!term) return this.listProducts();

    return this.db
      .select()
      .from(products)
      .where(
        or(
          ilike(products.name, `%${term}%`),
          ilike(products.description, `%${term}%`),
        ),
      );
  }

  async getProduct(productId: string): Promise<Product | null> {
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    return product ?? null;
  }

  async getCart(userId: string): Promise<CartItem[]> {
    const [cart] = await this.db
      .select({ items: carts.items })
      .from(carts)
      .where(eq(carts.userId, userId))
      .limit(1);
    return cart?.items ?? [];
  }

  async addToCart(
    userId: string,
    productId: string,
    qty: number,
  ): Promise<{ product: Product; cart: CartItem[] }> {
    const product = await this.getProduct(productId);
    if (!product) throw new DomainError('product_not_found');

    const current = await this.getCart(userId);
    const next = addCartItem(current, product, qty);

    await this.db
      .insert(carts)
      .values({ userId, items: next })
      .onConflictDoUpdate({
        target: carts.userId,
        set: { items: next },
      });

    return { product, cart: next };
  }

  async removeFromCart(
    userId: string,
    productId: string,
  ): Promise<{ removed: CartItem; cart: CartItem[] }> {
    const current = await this.getCart(userId);
    const { removed, cart: next } = removeCartItem(current, productId);
    await this.db
      .insert(carts)
      .values({ userId, items: next })
      .onConflictDoUpdate({
        target: carts.userId,
        set: { items: next },
      });

    return { removed, cart: next };
  }

  async clearCart(userId: string): Promise<void> {
    await this.db
      .insert(carts)
      .values({ userId, items: [] })
      .onConflictDoUpdate({
        target: carts.userId,
        set: { items: [] },
      });
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const [created] = await this.db
      .insert(orders)
      .values(input)
      .onConflictDoNothing({ target: orders.checkoutQuoteId })
      .returning();
    if (created) return created;

    const [existing] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.checkoutQuoteId, input.checkoutQuoteId))
      .limit(1);
    if (
      !existing ||
      existing.userId !== input.userId ||
      existing.pinchPaymentId !== input.pinchPaymentId
    ) {
      throw new DomainError('order_create_failed');
    }
    return existing;
  }

  async listOrders(username?: string): Promise<Order[]> {
    return this.db
      .select()
      .from(orders)
      .where(username ? eq(orders.username, username) : undefined)
      .orderBy(desc(orders.createdAt));
  }
}
