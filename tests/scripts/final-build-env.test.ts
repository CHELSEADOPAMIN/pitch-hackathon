import { describe, expect, it } from 'vitest';

import { resolveFinalBuildEnvironment } from '../../scripts/final-build-env';

const validEnvironment = {
  OPENAI_API_KEY: 'openai_test',
  DATABASE_URL: 'postgres://localhost/pinch',
  DATABASE_SCHEMA: 'public',
  PINCH_APPLICATION_ID: 'app_test_demo',
  PINCH_SECRET_KEY: 'sk_test_demo',
  PINCH_PUBLISHABLE_KEY: 'pk_test_demo',
  PINCH_API_BASE_URL: 'https://api.getpinch.com.au/test',
  PINCH_API_VERSION: '2020.1',
  HOST: '0.0.0.0',
  PORT: '8787',
  EXPO_PUBLIC_API_URL: 'https://pinch.example.test',
};

describe('final Android build environment', () => {
  it('maps the Pinch publishable key into the public Expo bundle', () => {
    const result = resolveFinalBuildEnvironment(validEnvironment);

    expect(result).toMatchObject({
      EXPO_PUBLIC_API_URL: 'https://pinch.example.test',
      EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY: 'pk_test_demo',
      EXPO_PUBLIC_ENABLE_DEMO_CONTROLS: '1',
      EXPO_ANDROID_PACKAGE: 'au.com.crokily.pinchvoice.glasses',
      PINCH_FINAL_BUILD: '1',
    });
  });

  it('rejects an incomplete server environment', () => {
    expect(() =>
      resolveFinalBuildEnvironment({
        ...validEnvironment,
        OPENAI_API_KEY: '',
      }),
    ).toThrow('OPENAI_API_KEY');
  });

  it('rejects mismatched client and server Pinch keys', () => {
    expect(() =>
      resolveFinalBuildEnvironment({
        ...validEnvironment,
        EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY: 'pk_test_other',
      }),
    ).toThrow('must match');
  });

  it('rejects a non-HTTPS public API URL', () => {
    expect(() =>
      resolveFinalBuildEnvironment({
        ...validEnvironment,
        EXPO_PUBLIC_API_URL: 'http://pinch.example.test',
      }),
    ).toThrow('HTTPS');
  });
});
