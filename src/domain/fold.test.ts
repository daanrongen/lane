import { describe, expect, test } from "bun:test";
import type { RunEvent } from "@/domain/events.ts";
import { fold, foldAll } from "@/domain/fold.ts";
import { AgentId, SessionId, SpanId } from "@/domain/ids.ts";
import { emptyRun, emptyUsage } from "@/domain/run.ts";
import { timeline } from "@/domain/timeline.ts";

const main = AgentId("main");
const sub = AgentId("sub");
const run0 = emptyRun(SessionId("s1"), 0);

const events: RunEvent[] = [
  {
    _tag: "AgentSpawned",
    agent: { id: main, parentId: null, name: "Orchestrator" },
    at: 0,
  },
  {
    _tag: "AgentSpawned",
    agent: { id: sub, parentId: main, name: "Explore" },
    at: 2,
  },
  {
    _tag: "SpanOpened",
    span: {
      _tag: "ToolCall",
      id: SpanId("t1"),
      agentId: sub,
      label: "Grep",
      tool: "Grep",
      failed: false,
      start: 3,
    },
  },
  {
    _tag: "TurnReported",
    turn: { agentId: sub, at: 3, usage: { ...emptyUsage, input: 10 } },
  },
  { _tag: "SpanClosed", spanId: SpanId("t1"), at: 4, failed: true },
  { _tag: "AgentFinished", agentId: sub, at: 6 },
];

describe("fold", () => {
  const run = foldAll(run0, events);

  test("spawning a child records a handoff, finishing is logged", () => {
    expect(run.agents.map((a) => a.id)).toEqual([main, sub]);
    expect(run.handoffs).toEqual([{ from: main, to: sub, at: 2 }]);
    expect(run.finishes).toEqual([{ agentId: sub, at: 6 }]);
  });

  test("the link return does not depend on event order", () => {
    const lifecycle = events.filter(
      (e) => e._tag === "AgentSpawned" || e._tag === "AgentFinished",
    );
    const reversed = foldAll(run0, lifecycle.reverse());
    expect(timeline(reversed, 10).links[0]?.returnedAt).toBe(6);
  });

  test("RunStarted sets the epoch origin", () => {
    expect(fold(run0, { _tag: "RunStarted", startedAt: 42 }).startedAt).toBe(
      42,
    );
  });

  test("orchestrator spawn creates no handoff", () => {
    const [spawnMain] = events;
    expect(spawnMain && fold(run0, spawnMain).handoffs).toEqual([]);
  });

  test("closing a tool span sets end and failure", () => {
    const s = run.spans[0];
    expect(s?.end).toBe(4);
    expect(s?._tag === "ToolCall" && s.failed).toBe(true);
  });

  test("turns are appended to the run", () => {
    expect(run.turns).toHaveLength(1);
    expect(run.turns[0]?.usage.input).toBe(10);
  });

  test("fold does not mutate its input", () => {
    expect(run0.agents).toEqual([]);
  });
});
