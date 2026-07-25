import type { CheckoutConfirmation } from "@/lib/realtime-protocol";

export type DemoRole = "customer" | "staff";

export type DemoUser = {
  id: string;
  username: string;
};

export type CartItem = {
  productId: string;
  name: string;
  priceCents: number;
  qty: number;
};

export type AgentResult =
  | {
      status: "completed";
      action: "added" | "removed" | "cart" | "searched";
      facts: Record<string, unknown>;
    }
  | {
      status: "ambiguous";
      candidates: { productId: string; name: string; priceCents: number }[];
    }
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

export type AgentRequest = {
  userId: string;
  request: string;
  imageBase64?: string;
  checkoutConfirmation?: CheckoutConfirmation;
};

export type Order = {
  id: string;
  userId: string;
  username: string;
  items: CartItem[];
  totalCents: number;
  status: string;
  checkoutQuoteId: string;
  pinchPaymentId: string;
  createdAt: string;
};

export type VoicePhase =
  | "idle"
  | "requesting-permissions"
  | "connecting"
  | "listening"
  | "speaking"
  | "capturing"
  | "thinking"
  | "charging"
  | "reconnecting"
  | "error";
