import { describe, expect, it } from 'vitest';

import {
  addCartItem,
  cartItemCount,
  cartTotalCents,
  removeCartItem,
} from '../../server/domain/cart';
import type { CartItem, Product } from '../../server/domain/types';

const MILK: Product = {
  id: 'milk',
  merchantId: 'merchant',
  name: 'Full Cream Milk 1L',
  priceCents: 390,
  description: 'Milk bottle',
};

const CART: CartItem[] = [
  {
    productId: 'chips',
    name: 'Original Chips',
    priceCents: 550,
    qty: 1,
  },
];

describe('cart facts', () => {
  it('adds a real product using its integer database price', () => {
    const next = addCartItem(CART, MILK, 2);

    expect(next).toEqual([
      ...CART,
      {
        productId: 'milk',
        name: 'Full Cream Milk 1L',
        priceCents: 390,
        qty: 2,
      },
    ]);
    expect(CART).toHaveLength(1);
  });

  it('increments an existing item and refreshes its database facts', () => {
    const next = addCartItem(
      [{ productId: 'milk', name: 'Old', priceCents: 1, qty: 1 }],
      MILK,
      2,
    );

    expect(next).toEqual([
      {
        productId: 'milk',
        name: 'Full Cream Milk 1L',
        priceCents: 390,
        qty: 3,
      },
    ]);
  });

  it('removes a product completely and reports the removed facts', () => {
    const withMilk = addCartItem(CART, MILK, 1);
    const result = removeCartItem(withMilk, 'milk');

    expect(result.removed.productId).toBe('milk');
    expect(result.cart).toEqual(CART);
  });

  it('calculates exact item count and integer-cent total', () => {
    const cart = addCartItem(CART, MILK, 2);

    expect(cartItemCount(cart)).toBe(3);
    expect(cartTotalCents(cart)).toBe(1_330);
  });

  it('rejects non-integer cents instead of rounding', () => {
    expect(() => addCartItem(CART, { ...MILK, priceCents: 3.9 }, 1)).toThrow(
      'invalid_cart_amount',
    );
  });
});
