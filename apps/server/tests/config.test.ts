import { describe, expect, it } from "vitest";

import { parseServerConfig } from "../src/config/server-config.js";

describe("server configuration", () => {
  const validInput = {
    PINCH_APPLICATION_ID: "app_test_example",
    PINCH_SECRET_KEY: "sk_test_example",
    PINCH_PUBLISHABLE_KEY: "pk_test_example",
    PINCH_API_BASE_URL: "https://api.getpinch.com.au/test",
    PINCH_API_VERSION: "2020.1",
    OPENAI_API_KEY: "openai_test_value",
    DATABASE_URL: "postgresql://user:password@example.test/database",
  };

  it("uses a local-development host by default and accepts a deployment override", () => {
    expect(parseServerConfig(validInput).hostname).toBe("0.0.0.0");
    expect(
      parseServerConfig({ ...validInput, HOST: "127.0.0.1" }).hostname,
    ).toBe("127.0.0.1");
  });

  it("rejects missing secrets without including other values in the error", () => {
    const input = {
      PINCH_APPLICATION_ID: "application_value",
      PINCH_SECRET_KEY: "pinch_secret_value",
      PINCH_PUBLISHABLE_KEY: "publishable_value",
      PINCH_API_BASE_URL: "https://api.example.test/test",
      PINCH_API_VERSION: "2020.1",
      DATABASE_URL: "postgresql://user:password@example.test/database",
    };

    expect(() => parseServerConfig(input)).toThrow("OPENAI_API_KEY");
    try {
      parseServerConfig(input);
    } catch (error) {
      expect(String(error)).not.toContain("pinch_secret_value");
      expect(String(error)).not.toContain("password");
    }
  });

  it("hard-rejects live Pinch mode and non-test Pinch credentials", () => {
    const input = {
      PINCH_APPLICATION_ID: "app_live_example",
      PINCH_SECRET_KEY: "sk_live_example",
      PINCH_PUBLISHABLE_KEY: "pk_live_example",
      PINCH_API_BASE_URL: "https://api.getpinch.com.au/live",
      PINCH_API_VERSION: "2020.1",
      OPENAI_API_KEY: "openai_test_value",
      DATABASE_URL: "postgresql://user:password@example.test/database",
    };

    expect(() => parseServerConfig(input)).toThrow("PINCH_API_BASE_URL");
    expect(() => parseServerConfig(input)).toThrow("PINCH_SECRET_KEY");
  });

  it("rejects a lookalike test path on a non-Pinch host", () => {
    const input = {
      PINCH_APPLICATION_ID: "app_test_example",
      PINCH_SECRET_KEY: "sk_test_example",
      PINCH_PUBLISHABLE_KEY: "pk_test_example",
      PINCH_API_BASE_URL: "https://attacker.example/test",
      PINCH_API_VERSION: "2020.1",
      OPENAI_API_KEY: "openai_test_value",
      DATABASE_URL: "postgresql://user:password@example.test/database",
    };

    expect(() => parseServerConfig(input)).toThrow("PINCH_API_BASE_URL");
  });
});
