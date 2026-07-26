import { describe, expect, it } from 'vitest';

import { prepareCardDetails } from '../src/lib/card-details';

const NOW = new Date('2026-07-25T00:00:00Z');

describe('card details', () => {
  it('normalizes a valid card before direct Pinch tokenization', () => {
    expect(
      prepareCardDetails(
        {
          cardHolderName: '  Demo Shopper ',
          cardNumber: '4242 4242 4242 4242',
          expiryMonth: '01',
          expiryYear: '2030',
          cvc: '123',
        },
        NOW,
      ),
    ).toEqual({
      ok: true,
      value: {
        sourceType: 'credit-card',
        cardHolderName: 'Demo Shopper',
        cardNumber: '4242424242424242',
        expiryMonth: 1,
        expiryYear: 2030,
        cvc: '123',
      },
    });
  });

  it('rejects a card number with a bad checksum', () => {
    expect(
      prepareCardDetails(
        {
          cardHolderName: 'Demo Shopper',
          cardNumber: '4242 4242 4242 4241',
          expiryMonth: '01',
          expiryYear: '2030',
          cvc: '123',
        },
        NOW,
      ),
    ).toEqual({ ok: false, message: 'Check the card number.' });
  });

  it('rejects expired cards and invalid security codes', () => {
    expect(
      prepareCardDetails(
        {
          cardHolderName: 'Demo Shopper',
          cardNumber: '4242 4242 4242 4242',
          expiryMonth: '06',
          expiryYear: '2026',
          cvc: '12',
        },
        NOW,
      ),
    ).toEqual({ ok: false, message: 'Check the expiry date.' });
  });
});
