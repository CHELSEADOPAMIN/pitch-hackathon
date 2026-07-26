import { z } from 'zod';

function isPinchTestBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'api.getpinch.com.au' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === '' &&
      url.pathname.replace(/\/$/, '') === '/test'
    );
  } catch {
    return false;
  }
}

const serverConfigSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DATABASE_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .default('public'),
  PINCH_APPLICATION_ID: z.string().startsWith('app_test_'),
  PINCH_SECRET_KEY: z.string().startsWith('sk_test_'),
  PINCH_PUBLISHABLE_KEY: z.string().startsWith('pk_test_'),
  PINCH_API_BASE_URL: z
    .string()
    .url()
    .refine(isPinchTestBaseUrl)
    .default('https://api.getpinch.com.au/test'),
  PINCH_API_VERSION: z.string().default('2020.1'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export function readServerConfig(
  environment: Record<string, string | undefined> = process.env,
): ServerConfig {
  return serverConfigSchema.parse(environment);
}
