import { describe, expect, test } from "bun:test";
import { AgentId, SpanId, ThreadId } from "@/domain/ids.ts";
import {
  type Agent,
  emptyRun,
  emptyUsage,
  type Run,
  type Span,
} from "@/domain/run.ts";
import { timeline } from "@/domain/timeline.ts";

const agent = (id: string, parentId: string | null): Agent => ({
  id: AgentId(id),
  parentId: parentId ? AgentId(parentId) : null,
  name: id,
});

const tool = (
  id: string,
  agentId: string,
  start: number,
  end?: number,
): Span => ({
  _tag: "ToolCall",
  id: SpanId(id),
  agentId: AgentId(agentId),
  label: id,
  tool: "Grep",
  failed: false,
  start,
  end,
});

const run: Run = {
  ...emptyRun(ThreadId("s"), 0),
  // Spawn order is deliberately not tree order.
  agents: [
    agent("main", null),
    agent("a", "main"),
    agent("b", "main"),
    agent("a1", "a"),
  ],
  spans: [tool("t2", "a", 5, 6), tool("t1", "a", 2, 3), tool("t3", "b", 4)],
  handoffs: [{ from: AgentId("main"), to: AgentId("a"), at: 1 }],
  finishes: [{ agentId: AgentId("a"), at: 9 }],
  turns: [
    {
      agentId: AgentId("a"),
      at: 2,
      model: "m1",
      usage: { ...emptyUsage, input: 10 },
    },
    {
      agentId: AgentId("a"),
      at: 5,
      model: "m2",
      usage: { ...emptyUsage, input: 20 },
    },
  ],
};

describe("timeline", () => {
  const tl = timeline(run, 7);

  test("orders lanes parents first with depth", () => {
    expect(tl.lanes.map((l) => [String(l.agent.id), l.depth])).toEqual([
      ["main", 0],
      ["a", 1],
      ["a1", 2],
      ["b", 1],
    ]);
  });

  test("sorts bars by start", () => {
    const a = tl.lanes.find((l) => l.agent.id === "a");
    expect(a?.bars.flatMap((b) => b.spans.map((s) => s.id))).toEqual([
      SpanId("t1"),
      SpanId("t2"),
    ]);
  });

  test("open spans grow to now", () => {
    const b = tl.lanes.find((l) => l.agent.id === "b")?.bars[0];
    expect(b).toMatchObject({ start: 4, end: 7, open: true });
  });

  test("duration covers handoff returns, usage sums spans", () => {
    expect(tl.duration).toBe(9);
    expect(tl.usage.input).toBe(30);
  });

  test("lane exposes its latest model and turn", () => {
    const a = tl.lanes.find((l) => l.agent.id === "a");
    expect(a?.model).toBe("m2");
    expect(a?.lastTurn?.usage.input).toBe(20);
    expect(tl.lanes[0]?.model).toBeUndefined();
  });

  test("empty run is zero-length", () => {
    expect(timeline(emptyRun(ThreadId("e"), 0), 0).duration).toBe(0);
  });
});

const waiting = (id: string, start: number, end: number): Span => ({
  _tag: "Waiting",
  id: SpanId(id),
  agentId: AgentId("main"),
  label: id,
  start,
  end,
  on: AgentId("a"),
});

describe("timeline lanes", () => {
  const base = {
    ...emptyRun(ThreadId("s"), 0),
    agents: [agent("main", null)],
  };

  test("overlapping waits merge, disjoint ones stay apart", () => {
    const run: Run = {
      ...base,
      spans: [waiting("w1", 1, 5), waiting("w2", 2, 8), waiting("w3", 10, 12)],
    };
    const bars = timeline(run, 20).lanes[0]?.bars;
    expect(bars?.map((b) => [b.start, b.end, b.spans.length])).toEqual([
      [1, 8, 2],
      [10, 12, 1],
    ]);
  });

  test("an open wait keeps the merged bar open", () => {
    const run: Run = {
      ...base,
      spans: [waiting("w1", 1, 5), { ...waiting("w2", 2, 8), end: undefined }],
    };
    expect(timeline(run, 9).lanes[0]?.bars[0]).toMatchObject({
      end: 9,
      open: true,
    });
  });

  test("finished means a finish at or after the last activity", () => {
    const at = (t: number) => ({
      ...base,
      spans: [tool("t1", "main", 1, t)],
      finishes: [{ agentId: AgentId("main"), at: 5 }],
    });
    expect(timeline(at(5), 9).lanes[0]?.finished).toBe(true);
    expect(timeline(at(7), 9).lanes[0]?.finished).toBe(false);
    expect(timeline(base, 9).lanes[0]?.finished).toBe(false);
    expect(timeline(at(7), 9).lanes[0]?.lastActivity).toBe(7);
  });
});
