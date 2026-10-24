import { describe, expect, test } from "bun:test";
import { duration, modelName, plural, tokens } from "@/ui/lib/format.ts";

describe("format", () => {
  test("duration picks the largest sensible units", () => {
    expect([0, 12.4, 59.6, 60, 200, 3600, 7260].map(duration)).toEqual([
      "0s",
      "12s",
      "1m00s",
      "1m00s",
      "3m20s",
      "1h00m",
      "2h01m",
    ]);
  });

  test("tokens abbreviate thousands and millions", () => {
    expect([0, 999, 1000, 50_308, 1_500_000].map(tokens)).toEqual([
      "0",
      "999",
      "1k",
      "50.3k",
      "1.5M",
    ]);
  });

  test("model names drop the vendor prefix", () => {
    expect(modelName("claude-opus-5-5")).toBe("opus-5-5");
    expect(modelName("gpt-6")).toBe("gpt-6");
  });

  test("plural only adds an s when needed", () => {
    expect([1, 0, 5].map((n) => plural(n, "agent"))).toEqual([
      "1 agent",
      "0 agents",
      "5 agents",
    ]);
  });
});
