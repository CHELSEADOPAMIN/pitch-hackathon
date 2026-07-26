import {
  check,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { CartItem } from '../domain/types';

export const databaseSchema = pgSchema('codex_voice');

export const merchants = databaseSchema.table('merchants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const users = databaseSchema.table(
  'users',
  {
    id: text('id')
      .$defaultFn(() => randomUUID())
      .primaryKey(),
    username: text('username').notNull(),
    pinchPayerId: text('pinch_payer_id'),
    pinchSourceId: text('pinch_source_id'),
  },
  (table) => [uniqueIndex('users_username_unique').on(table.username)],
);

export const products = databaseSchema.table(
  'products',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id),
    name: text('name').notNull(),
    priceCents: integer('price_cents').notNull(),
    description: text('description').notNull(),
  },
  (table) => [
    check('products_price_nonnegative', sql`${table.priceCents} >= 0`),
  ],
);

export const carts = databaseSchema.table('carts', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  items: jsonb('items').$type<CartItem[]>().notNull().default([]),
});

export const orders = databaseSchema.table(
  'orders',
  {
    id: text('id')
      .$defaultFn(() => `order_${randomUUID()}`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    username: text('username').notNull(),
    items: jsonb('items').$type<CartItem[]>().notNull(),
    totalCents: integer('total_cents').notNull(),
    status: text('status').$type<'paid'>().notNull(),
    checkoutQuoteId: text('checkout_quote_id').notNull(),
    pinchPaymentId: text('pinch_payment_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check('orders_total_nonnegative', sql`${table.totalCents} >= 0`),
    uniqueIndex('orders_checkout_quote_unique').on(table.checkoutQuoteId),
    uniqueIndex('orders_pinch_payment_unique').on(table.pinchPaymentId),
  ],
);

export const schema = {
  merchants,
  users,
  products,
  carts,
  orders,
};
