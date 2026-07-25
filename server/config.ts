import { z } from 'zod';

const serverConfigSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  PINCH_APPLICATION_ID: z.string().min(1),
  PINCH_SECRET_KEY: z.string().min(1),
  PINCH_API_BASE_URL: z
    .string()
    .url()
    .default('https://api.getpinch.com.au/test'),
  PINCH_API_VERSION: z.string().default('2020.1'),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export function readServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  return serverConfigSchema.parse(environment);
}
