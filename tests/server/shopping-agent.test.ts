import { describe, expect, it } from 'vitest';

import {
  hasTerminalSearchFailure,
  SHOPPING_AGENT_MAX_STEPS,
  shoppingAgentPrompt,
  shoppingModelMessage,
} from '../../server/agent/shopping-agent';

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

  it('treats the deliberately held foreground product as the image target', () => {
    const prompt = shoppingAgentPrompt(
      '- product_bar: Musashi Protein Crisp; black snack wrapper',
    );

    expect(prompt).toContain('deliberately holding closest to the camera');
    expect(prompt).toContain('held foreground package as background');
    expect(prompt).toContain('Never select a background product');
  });

  it('stops immediately after catalogue search proves no match', () => {
    expect(
      hasTerminalSearchFailure([
        {
          toolName: 'search_products',
          output: { status: 'error', reason: 'product_not_found' },
        },
      ]),
    ).toBe(true);
    expect(
      hasTerminalSearchFailure([
        {
          toolName: 'search_products',
          output: { status: 'search_results', products: [] },
        },
      ]),
    ).toBe(false);
  });

  it('caps pathological loops without constraining normal two-step flows', () => {
    expect(SHOPPING_AGENT_MAX_STEPS).toBe(6);
  });
});
