import { describe, expect, it } from 'vitest';

import { shoppingModelMessage } from '../../server/agent/shopping-agent';

describe('Terra shopping message', () => {
  it('uses the AI SDK v7 canonical JPEG file part with raw base64', () => {
    const message = shoppingModelMessage({
      userId: 'user_1',
      request: 'Add the product shown in the photo',
      imageBase64: 'raw-base64',
    });

    expect(message).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Add the product shown in the photo' },
        {
          type: 'file',
          mediaType: 'image/jpeg',
          data: 'raw-base64',
        },
      ],
    });
  });

  it('includes only the server-validated confirmed quote', () => {
    const message = shoppingModelMessage({
      userId: 'user_1',
      request: 'The customer explicitly confirmed the prepared quote',
      checkoutConfirmation: { quoteId: 'q_exact', confirmed: true },
    });

    expect(message).toMatchObject({
      content: [
        {
          type: 'text',
          text: expect.stringContaining('Explicitly confirmed quote: q_exact'),
        },
      ],
    });
  });
});
