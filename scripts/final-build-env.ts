import { readServerConfig } from '../server/config';

type Environment = Record<string, string | undefined>;

const requiredServerKeys = [
  'OPENAI_API_KEY',
  'DATABASE_URL',
  'DATABASE_SCHEMA',
  'PINCH_APPLICATION_ID',
  'PINCH_SECRET_KEY',
  'PINCH_PUBLISHABLE_KEY',
  'PINCH_API_BASE_URL',
  'PINCH_API_VERSION',
  'HOST',
  'PORT',
] as const;

const glassesIdentity = {
  EXPO_OWNER: 'crokily',
  EXPO_APP_NAME: 'Pinch Glasses',
  EXPO_APP_SLUG: 'pinch-voice-shopping-glasses',
  EXPO_SCHEME: 'pinchvoiceglasses',
  EXPO_ANDROID_PACKAGE: 'au.com.crokily.pinchvoice.glasses',
  EXPO_EAS_PROJECT_ID: '2dc66597-70dc-4317-b003-95f3ed58fea1',
} as const;

function requireValue(environment: Environment, key: string) {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(`Final build environment is missing ${key}.`);
  }
  return value;
}

function requirePublicApiUrl(environment: Environment) {
  const value = requireValue(environment, 'EXPO_PUBLIC_API_URL');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'EXPO_PUBLIC_API_URL must be a clean HTTPS origin or path.',
    );
  }
  return value.replace(/\/$/, '');
}

export function resolveFinalBuildEnvironment(
  environment: Environment,
): NodeJS.ProcessEnv {
  for (const key of requiredServerKeys) {
    requireValue(environment, key);
  }
  const serverConfig = readServerConfig(environment);
  const apiUrl = requirePublicApiUrl(environment);
  const publishableKey =
    environment.EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY?.trim() ??
    serverConfig.PINCH_PUBLISHABLE_KEY;

  if (!publishableKey.startsWith('pk_test_')) {
    throw new Error(
      'EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY must be a Pinch sandbox publishable key.',
    );
  }
  if (publishableKey !== serverConfig.PINCH_PUBLISHABLE_KEY) {
    throw new Error(
      'Client and server Pinch publishable keys must match for the final build.',
    );
  }

  return {
    ...environment,
    ...glassesIdentity,
    NODE_ENV: 'production',
    EXPO_PUBLIC_API_URL: apiUrl,
    EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY: publishableKey,
    EXPO_PUBLIC_ENABLE_DEMO_CONTROLS: '1',
    PINCH_FINAL_BUILD: '1',
  };
}

export const finalBuildEnvironmentKeys = {
  server: requiredServerKeys,
  client: [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_ENABLE_DEMO_CONTROLS',
    ...Object.keys(glassesIdentity),
  ],
};
