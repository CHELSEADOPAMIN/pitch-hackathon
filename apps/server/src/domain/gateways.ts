import type { Payment } from "./types.js";

export interface PaymentGateway {
  charge(input: {
    payerId: string;
    sourceId: string;
    amount: number;
    description: string;
    nonce: string;
  }): Promise<Payment>;
}

export interface CustomerGateway {
  createPayer(input: {
    firstName: string;
    emailAddress: string;
  }): Promise<{ id: string }>;
  attachSource(input: {
    payerId: string;
    token: string;
  }): Promise<{ id: string }>;
}
