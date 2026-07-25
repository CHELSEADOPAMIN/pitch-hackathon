import type { CartItem, Product } from './types';
import { DomainError } from './types';

export function addCartItem(
  current: CartItem[],
  product: Product,
  qty: number,
): CartItem[] {
  if (
    !Number.isInteger(qty) ||
    qty < 1 ||
    !Number.isInteger(product.priceCents) ||
    product.priceCents < 0
  ) {
    throw new DomainError('invalid_cart_amount');
  }

  const existing = current.find((item) => item.productId === product.id);
  if (!existing) {
    return [
      ...current,
      {
        productId: product.id,
        name: product.name,
        priceCents: product.priceCents,
        qty,
      },
    ];
  }

  return current.map((item) =>
    item.productId === product.id
      ? {
          ...item,
          name: product.name,
          priceCents: product.priceCents,
          qty: item.qty + qty,
        }
      : item,
  );
}

export function removeCartItem(
  current: CartItem[],
  productId: string,
): { removed: CartItem; cart: CartItem[] } {
  const removed = current.find((item) => item.productId === productId);
  if (!removed) throw new DomainError('product_not_in_cart');
  return {
    removed,
    cart: current.filter((item) => item.productId !== productId),
  };
}

export function cartTotalCents(items: CartItem[]) {
  return items.reduce((total, item) => {
    if (
      !Number.isInteger(item.priceCents) ||
      item.priceCents < 0 ||
      !Number.isInteger(item.qty) ||
      item.qty < 1
    ) {
      throw new DomainError('invalid_cart_amount');
    }
    return total + item.priceCents * item.qty;
  }, 0);
}

export function cartItemCount(items: CartItem[]) {
  return items.reduce((count, item) => count + item.qty, 0);
}
