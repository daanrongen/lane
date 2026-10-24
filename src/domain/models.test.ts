import { describe, expect, test } from "bun:test";
import { providerOf } from "@/domain/models.ts";

describe("providerOf", () => {
  test("reads the provider from the model name", () => {
    expect(providerOf("claude-sonnet-5-5")).toBe("anthropic");
    expect(providerOf("gpt-5.5")).toBe("openai");
    expect(providerOf("gpt-oss:20b")).toBe("ollama");
    expect(providerOf("gemma4:31b-cloud")).toBe("ollama");
    expect(providerOf("mystery")).toBeUndefined();
    expect(providerOf(undefined)).toBeUndefined();
  });
});
