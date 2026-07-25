const DEFAULT_API_BASE_URL = "http://10.0.2.2:8787";
const DEFAULT_PINCH_API_BASE_URL = "https://api.getpinch.com.au/test";
const DEFAULT_PINCH_API_VERSION = "2020.1";

function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export const clientConfig = {
  apiBaseUrl: withoutTrailingSlash(
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
  ),
  pinchApiBaseUrl: withoutTrailingSlash(
    process.env.EXPO_PUBLIC_PINCH_API_BASE_URL?.trim() ||
      DEFAULT_PINCH_API_BASE_URL,
  ),
  pinchApiVersion:
    process.env.EXPO_PUBLIC_PINCH_API_VERSION?.trim() ||
    DEFAULT_PINCH_API_VERSION,
  pinchPublishableKey:
    process.env.EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY?.trim() || "",
} as const;

export function assertTestPaymentConfig() {
  if (!clientConfig.pinchApiBaseUrl.endsWith("/test")) {
    throw new Error("This demo is locked to Pinch test mode.");
  }
  if (!clientConfig.pinchPublishableKey.startsWith("pk_test_")) {
    throw new Error(
      "Add a Pinch test publishable key to the mobile environment.",
    );
  }
}
