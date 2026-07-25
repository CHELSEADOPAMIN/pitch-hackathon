import assert from "node:assert/strict";
import test from "node:test";

import { prepareCardDetails } from "./card-details.ts";

test("normalizes a valid card draft for Pinch direct tokenization", () => {
  const result = prepareCardDetails(
    {
      cardHolderName: "  Demo Shopper ",
      cardNumber: "4242 4242 4242 4242",
      expiryMonth: "01",
      expiryYear: "2030",
      cvc: "123",
    },
    new Date("2026-07-25T00:00:00Z"),
  );

  assert.deepEqual(result, {
    ok: true,
    value: {
      sourceType: "credit-card",
      cardHolderName: "Demo Shopper",
      cardNumber: "4242424242424242",
      expiryMonth: 1,
      expiryYear: 2030,
      cvc: "123",
    },
  });
});

test("rejects a card number that fails its checksum", () => {
  const result = prepareCardDetails(
    {
      cardHolderName: "Demo Shopper",
      cardNumber: "4242 4242 4242 4241",
      expiryMonth: "01",
      expiryYear: "2030",
      cvc: "123",
    },
    new Date("2026-07-25T00:00:00Z"),
  );

  assert.deepEqual(result, { ok: false, message: "Check the card number." });
});

test("rejects an expired card", () => {
  const result = prepareCardDetails(
    {
      cardHolderName: "Demo Shopper",
      cardNumber: "4242424242424242",
      expiryMonth: "06",
      expiryYear: "2026",
      cvc: "123",
    },
    new Date("2026-07-25T00:00:00Z"),
  );

  assert.deepEqual(result, { ok: false, message: "Check the expiry date." });
});
