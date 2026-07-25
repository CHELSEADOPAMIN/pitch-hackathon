import type { Cart, CreateOrderInput, Order, Product, User } from "./types.js";

export interface ShoppingRepository {
  findProduct(productId: string): Promise<Product | undefined>;
  searchProducts(query: string): Promise<Product[]>;
  findUser(userId: string): Promise<User | undefined>;
  upsertUser(user: Pick<User, "id" | "username">): Promise<User>;
  setPayerId(userId: string, payerId: string): Promise<User>;
  setSourceId(userId: string, sourceId: string): Promise<User>;
  getCart(userId: string): Promise<Cart>;
  saveCart(cart: Cart): Promise<void>;
  createOrderOnce(order: CreateOrderInput): Promise<Order>;
  listOrders(): Promise<Order[]>;
}
