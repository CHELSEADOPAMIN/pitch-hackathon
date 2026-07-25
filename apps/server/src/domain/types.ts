export type Product = {
  id: string;
  merchantId: string;
  name: string;
  priceCents: number;
  description: string;
};

export type ProductMatch = {
  productId: string;
  name: string;
  priceCents: number;
};

export type User = {
  id: string;
  username: string;
  pinchPayerId?: string;
  pinchSourceId?: string;
};

export type CartItem = {
  productId: string;
  name: string;
  priceCents: number;
  qty: number;
};

export type Cart = {
  userId: string;
  items: CartItem[];
};

export type Order = {
  id: string;
  userId: string;
  username: string;
  items: CartItem[];
  totalCents: number;
  status: "paid";
  checkoutQuoteId: string;
  pinchPaymentId: string;
  createdAt: Date;
};

export type CreateOrderInput = Omit<Order, "createdAt"> & { createdAt: Date };

export type Payment = {
  id: string;
  status: string;
};

export type CartFacts = {
  items: CartItem[];
  cartCount: number;
  totalCents: number;
};

export type AgentResult =
  | {
      status: "completed";
      action: "added";
      facts: {
        cartCount: number;
        item: CartItem;
        totalCents: number;
      };
    }
  | {
      status: "completed";
      action: "removed";
      facts: {
        cartCount: number;
        removedProductId: string;
        totalCents: number;
      };
    }
  | { status: "completed"; action: "cart"; facts: CartFacts }
  | {
      status: "completed";
      action: "searched";
      facts: { products: ProductMatch[] };
    }
  | { status: "ambiguous"; candidates: ProductMatch[] }
  | { status: "not_found"; entity: "product"; query: string }
  | {
      status: "needs_confirmation";
      quoteId: string;
      expiresAt: string;
      items: CartItem[];
      totalCents: number;
    }
  | { status: "paid"; paymentId: string; totalCents: number }
  | { status: "error"; reason: string };
