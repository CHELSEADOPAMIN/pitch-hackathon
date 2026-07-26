import { describe, expect, it } from 'vitest';

import { readServerConfig } from '../../server/config';

const VALID_ENVIRONMENT = {
  OPENAI_API_KEY: 'openai_test',
  DATABASE_URL: 'postgres://localhost/pinch',
  PINCH_APPLICATION_ID: 'app_test_demo',
  PINCH_SECRET_KEY: 'sk_test_demo',
  PINCH_PUBLISHABLE_KEY: 'pk_test_demo',
  PINCH_API_BASE_URL: 'https://api.getpinch.com.au/test',
  PINCH_API_VERSION: '2020.1',
};

describe('server configuration', () => {
  it('defaults to the project schema and Pinch sandbox', () => {
    expect(readServerConfig(VALID_ENVIRONMENT)).toMatchObject({
      DATABASE_SCHEMA: 'public',
      PINCH_API_BASE_URL: 'https://api.getpinch.com.au/test',
      HOST: '0.0.0.0',
      PORT: 8787,
    });
  });

  it('accepts an isolated deployment schema', () => {
    expect(
      readServerConfig({
        ...VALID_ENVIRONMENT,
        DATABASE_SCHEMA: 'codex_voice',
      }).DATABASE_SCHEMA,
    ).toBe('codex_voice');
  });

  it('rejects live Pinch URLs and credentials', () => {
    expect(() =>
      readServerConfig({
        ...VALID_ENVIRONMENT,
        PINCH_API_BASE_URL: 'https://api.getpinch.com.au',
        PINCH_SECRET_KEY: 'sk_live_demo',
      }),
    ).toThrow();
  });
});
