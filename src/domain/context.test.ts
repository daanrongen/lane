import { describe, expect, test } from "bun:test";
import { contextGauge, contextMap, windowFor } from "@/domain/context.ts";
import { AgentId } from "@/domain/ids.ts";
import { type Entry, emptyUsage, type Setup } from "@/domain/run.ts";

describe("contextGauge", () => {
  test("sums what the model read and caps at the window", () => {
    const u = { input: 100, output: 50, cacheRead: 700, cacheWrite: 200 };
    expect(contextGauge(u, 2000)).toEqual({
      used: 1000,
      window: 2000,
      ratio: 0.5,
    });
    expect(contextGauge(u, 500).ratio).toBe(1);
  });

  test("unknown window has no ratio", () => {
    expect(contextGauge(emptyUsage, null).ratio).toBeNull();
  });
});

describe("contextMap", () => {
  const entry = (
    kind: Entry["kind"],
    label: string,
    tokens: number,
  ): Entry => ({ agentId: AgentId("a"), at: 0, kind, label, tokens });
  const W = 200_000;

  test("the remainder is system, the rest of the window is free", () => {
    const map = contextMap(
      [entry("File", "src/", 300), entry("File", "src/", 100)],
      undefined,
      1000,
      W,
    );
    expect(map.cells.map((c) => [c.label, c.tokens])).toEqual([
      ["src/", 400],
      ["System & tools", 600],
      ["Free", 199_000],
    ]);
  });

  test("a setup splits the system prompt and tool definitions out", () => {
    const setup: Setup = {
      agentId: AgentId("a"),
      at: 0,
      system: 100,
      tools: [
        { name: "Bash", tokens: 30 },
        { name: "Read", tokens: 20 },
        { name: "mcp__linear__list", tokens: 40 },
      ],
    };
    const map = contextMap([entry("Message", "Messages", 10)], setup, 300, W);
    expect(map.cells.map((c) => [c.label, c.tokens])).toEqual([
      ["System prompt", 100],
      ["Tool definitions", 50],
      ["mcp · linear", 40],
      ["Messages", 10],
      ["Other", 100],
      ["Free", W - 300],
    ]);
  });

  test("estimates above the real total are scaled down", () => {
    const map = contextMap(
      [entry("Message", "Messages", 3000)],
      undefined,
      1000,
      W,
    );
    expect(map.cells.map((c) => c.label)).toEqual(["Messages", "Free"]);
    expect(map.cells[0]?.tokens).toBe(1000);
  });

  test("small groups collapse into one cell", () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      entry("Tool", `t${i}`, 10),
    );
    const labels = contextMap(many, undefined, 140, W).cells.map(
      (c) => c.label,
    );
    expect(labels).toHaveLength(12);
    expect(labels).toContain("4 more");
  });
});

describe("windowFor", () => {
  test("Claude 5 models and anything past 200k get the 1M window", () => {
    expect(windowFor("claude-sonnet-5-5", 10)).toBe(1_000_000);
    expect(windowFor("claude-sonnet-4-5[1m]", 10)).toBe(1_000_000);
    expect(windowFor("claude-opus-4-5", 10)).toBe(200_000);
    expect(windowFor("claude-opus-4-5", 250_000)).toBe(1_000_000);
  });
});
