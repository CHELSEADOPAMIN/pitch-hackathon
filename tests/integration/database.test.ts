import 'dotenv/config';

import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const describeDatabase =
  process.env.RUN_DB_INTEGRATION === '1' ? describe : describe.skip;

describeDatabase('Supabase schema and seed', () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }
    sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('contains exactly the five planned domain tables', async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('users', 'products', 'carts', 'orders', 'merchants')
      order by table_name
    `;

    expect(rows.map(({ table_name }) => table_name)).toEqual([
      'carts',
      'merchants',
      'orders',
      'products',
      'users',
    ]);
  });

  it('has the two idempotency-critical unique indexes', async () => {
    const rows = await sql<{ indexname: string }[]>`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'users_username_unique',
          'orders_checkout_quote_unique'
        )
      order by indexname
    `;

    expect(rows.map(({ indexname }) => indexname)).toEqual([
      'orders_checkout_quote_unique',
      'users_username_unique',
    ]);
  });

  it('has 5–10 seeded products with integer-cent prices', async () => {
    const products = await sql<{ price_cents: number }[]>`
      select price_cents from products
    `;

    expect(products.length).toBeGreaterThanOrEqual(5);
    expect(products.length).toBeLessThanOrEqual(10);
    expect(
      products.every(
        ({ price_cents }) => Number.isInteger(price_cents) && price_cents >= 0,
      ),
    ).toBe(true);
  });
});
