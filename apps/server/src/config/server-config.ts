import { z } from "zod";

import { loadEnvironment } from "./load-environment.js";

const isPinchTestBaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "api.getpinch.com.au" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      url.pathname.replace(/\/$/, "") === "/test"
    );
  } catch {
    return false;
  }
};

const environmentSchema = z.object({
  PINCH_APPLICATION_ID: z.string().startsWith("app_test_"),
  PINCH_SECRET_KEY: z.string().startsWith("sk_test_"),
  PINCH_PUBLISHABLE_KEY: z.string().startsWith("pk_test_"),
  PINCH_API_BASE_URL: z.url().refine(isPinchTestBaseUrl),
  PINCH_API_VERSION: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_REALTIME_MODEL: z.string().min(1).default("gpt-realtime-2.1"),
  OPENAI_VISION_MODEL: z.string().min(1).default("gpt-5.6-terra"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
});

export type ServerConfig = {
  pinchApplicationId: string;
  pinchSecretKey: string;
  pinchPublishableKey: string;
  pinchApiBaseUrl: string;
  pinchApiVersion: string;
  openAiApiKey: string;
  openAiRealtimeModel: string;
  openAiVisionModel: string;
  databaseUrl: string;
  port: number;
};

export const parseServerConfig = (
  environment: Record<string, string | undefined>,
): ServerConfig => {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path[0])),
    ]
      .filter((field): field is string => typeof field === "string")
      .sort();
    throw new Error(`Invalid server configuration: ${fields.join(", ")}`);
  }

  const value = result.data;
  return {
    pinchApplicationId: value.PINCH_APPLICATION_ID,
    pinchSecretKey: value.PINCH_SECRET_KEY,
    pinchPublishableKey: value.PINCH_PUBLISHABLE_KEY,
    pinchApiBaseUrl: value.PINCH_API_BASE_URL.replace(/\/$/, ""),
    pinchApiVersion: value.PINCH_API_VERSION,
    openAiApiKey: value.OPENAI_API_KEY,
    openAiRealtimeModel: value.OPENAI_REALTIME_MODEL,
    openAiVisionModel: value.OPENAI_VISION_MODEL,
    databaseUrl: value.DATABASE_URL,
    port: value.PORT,
  };
};

export const loadServerConfig = (): ServerConfig => {
  loadEnvironment();
  return parseServerConfig(process.env);
};
