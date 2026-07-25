import type { Database } from './client';
import { merchants, products } from './schema';

export const DEMO_MERCHANT = {
  id: 'merchant_demo',
  name: 'Pinch Voice Demo Store',
};

export const DEMO_PRODUCTS = [
  {
    id: 'product_coke',
    merchantId: DEMO_MERCHANT.id,
    name: 'Coca-Cola Classic 600ml',
    priceCents: 450,
    description: 'Red label cola bottle',
  },
  {
    id: 'product_devondale',
    merchantId: DEMO_MERCHANT.id,
    name: 'Devondale Full Cream Milk 1L',
    priceCents: 320,
    description: 'Blue full cream milk carton',
  },
  {
    id: 'product_oak',
    merchantId: DEMO_MERCHANT.id,
    name: 'OAK Chocolate Milk 600ml',
    priceCents: 480,
    description: 'Brown chocolate flavoured milk carton',
  },
  {
    id: 'product_pepsi',
    merchantId: DEMO_MERCHANT.id,
    name: 'Pepsi Max 600ml',
    priceCents: 420,
    description: 'Black label sugar-free cola bottle',
  },
  {
    id: 'product_redbull',
    merchantId: DEMO_MERCHANT.id,
    name: 'Red Bull Energy Drink 250ml',
    priceCents: 460,
    description: 'Silver and blue energy drink can',
  },
  {
    id: 'product_smiths',
    merchantId: DEMO_MERCHANT.id,
    name: "Smith's Original Crinkle Cut 170g",
    priceCents: 550,
    description: 'Original potato chips',
  },
  {
    id: 'product_timtam',
    merchantId: DEMO_MERCHANT.id,
    name: 'Tim Tam Original 200g',
    priceCents: 500,
    description: 'Chocolate biscuit packet',
  },
  {
    id: 'product_water',
    merchantId: DEMO_MERCHANT.id,
    name: 'Mount Franklin Still Water 600ml',
    priceCents: 300,
    description: 'Clear still water bottle',
  },
] as const;

export async function seedDatabase(db: Database) {
  await db
    .insert(merchants)
    .values(DEMO_MERCHANT)
    .onConflictDoUpdate({
      target: merchants.id,
      set: { name: DEMO_MERCHANT.name },
    });

  for (const product of DEMO_PRODUCTS) {
    await db
      .insert(products)
      .values(product)
      .onConflictDoUpdate({
        target: products.id,
        set: {
          merchantId: product.merchantId,
          name: product.name,
          priceCents: product.priceCents,
          description: product.description,
        },
      });
  }
}
