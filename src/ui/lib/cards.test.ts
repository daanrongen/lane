import { describe, expect, test } from "bun:test";
import { AgentId, SpanId } from "@/domain/ids.ts";
import type { Span } from "@/domain/run.ts";
import { spanCard, tileCard } from "@/ui/lib/cards.ts";

const a = AgentId("a");
const tool = (id: string, name: string, start: number, end?: number): Span => ({
  _tag: "ToolCall",
  id: SpanId(id),
  agentId: a,
  label: name,
  tool: name,
  failed: false,
  start,
  end,
});
const names = new Map([[a, "Analyst"]]);

describe("spanCard", () => {
  test("a single call names the tool and how long it took", () => {
    const card = spanCard([tool("1", "Bash", 10, 10.4)], names);
    expect(card.title).toBe("Bash");
    expect(card.facts).toContainEqual(["took", "400ms"]);
  });

  test("an open span is still running", () => {
    expect(spanCard([tool("1", "Bash", 3)], names).facts).toContainEqual([
      "took",
      "running",
    ]);
  });

  test("a waiting span says on whom", () => {
    const wait: Span = {
      _tag: "Waiting",
      id: SpanId("w"),
      agentId: a,
      label: "x",
      on: a,
      start: 0,
      end: 5,
    };
    expect(spanCard([wait], names).subtitle).toBe("on Analyst");
  });

  test("merged spans are ranked by how often each tool ran", () => {
    const spans = [
      tool("1", "Read", 0, 1),
      tool("2", "Bash", 1, 2),
      tool("3", "Bash", 2, 3),
    ];
    const card = spanCard(spans, names);
    expect(card.title).toBe("3 spans");
    expect(card.list).toEqual([
      ["Bash", "×2"],
      ["Read", "×1"],
    ]);
  });
});

describe("tileCard", () => {
  test("shares are of what is used and of the window", () => {
    const cell = {
      kind: "File",
      label: "src/",
      tokens: 100,
      count: 3,
      parts: [],
    } as const;
    const card = tileCard(cell, { used: 400, window: 1000, cells: [cell] });
    expect(card.facts).toContainEqual(["of used", "25%"]);
    expect(card.facts).toContainEqual(["of window", "10%"]);
    expect(card.facts).toContainEqual(["items", "3"]);
  });
});
