import { describe, expect, test } from "bun:test";
import type { RunEvent } from "@/domain/events.ts";
import { foldAll } from "@/domain/fold.ts";
import { ActId, AgentId, SpanId, ThreadId } from "@/domain/ids.ts";
import { file, host } from "@/domain/ref.ts";
import { emptyRun } from "@/domain/run.ts";

const main = AgentId("main");
const run0 = emptyRun(ThreadId("t"), 0);

const tool = (id: string, name: string, start: number): RunEvent => ({
  _tag: "SpanOpened",
  span: {
    _tag: "ToolCall",
    id: SpanId(id),
    agentId: main,
    label: name,
    tool: name,
    failed: false,
    start,
  },
});

describe("acts derived from spans", () => {
  test("a tool call opens a running act of its kind", () => {
    const run = foldAll(run0, [tool("e1", "Edit", 1), tool("b1", "Bash", 2)]);
    expect(run.acts.map((a) => [a.kind, a.status])).toEqual([
      ["edit", "running"],
      ["shell", "running"],
    ]);
    expect(run.acts[0]?.edit).toEqual({ op: "modify" });
  });

  test("a write creates, an mcp call touches its server", () => {
    const run = foldAll(run0, [
      tool("w1", "Write", 1),
      {
        _tag: "SpanOpened",
        span: {
          _tag: "McpCall",
          id: SpanId("m1"),
          agentId: main,
          label: "list",
          server: "linear",
          tool: "list_issues",
          failed: false,
          start: 2,
        },
      },
    ]);
    expect(run.acts[0]?.edit).toEqual({ op: "create" });
    expect(run.acts[1]?.kind).toBe("mcp");
    expect(run.acts[1]?.touches).toEqual([
      { _tag: "Mcp", server: "linear", tool: "list_issues" },
    ]);
  });

  test("closing a span closes its act, a failure carries its class", () => {
    const run = foldAll(run0, [
      tool("b1", "Bash", 1),
      {
        _tag: "SpanClosed",
        spanId: SpanId("b1"),
        at: 3,
        failed: true,
        reason: "429 Too Many Requests",
      },
    ]);
    expect(run.acts[0]).toMatchObject({
      status: "failed",
      end: 3,
      failure: { class: "rate-limit" },
    });
  });

  test("an open ask or plan awaits a person", () => {
    const run = foldAll(run0, [
      tool("p1", "ExitPlanMode", 1),
      tool("q1", "AskUserQuestion", 2),
    ]);
    expect(run.acts.map((a) => a.status)).toEqual(["awaiting", "awaiting"]);
  });

  test("updates add touches and detail without replacing the act", () => {
    const run = foldAll(run0, [
      tool("e1", "Edit", 1),
      {
        _tag: "ActUpdated",
        id: ActId("e1"),
        touched: [file("/a.ts")],
      },
      {
        _tag: "ActUpdated",
        id: ActId("e1"),
        touched: [host("example.com")],
        approval: { by: "rule", rule: "Edit(*)", outcome: "allow" },
      },
    ]);
    expect(run.acts[0]?.touches).toEqual([file("/a.ts"), host("example.com")]);
    expect(run.acts[0]?.approval?.by).toBe("rule");
  });

  test("compaction is an act, and spans still fold as before", () => {
    const run = foldAll(run0, [
      tool("t1", "Read", 1),
      { _tag: "ContextCompacted", agentId: main, at: 5 },
    ]);
    expect(run.spans).toHaveLength(1);
    expect(run.acts.at(-1)).toMatchObject({
      kind: "compact",
      status: "ok",
      start: 5,
    });
  });

  test("signals, links and plans are recorded and a plan can be decided", () => {
    const run = foldAll(run0, [
      {
        _tag: "SignalReported",
        reading: {
          agentId: main,
          at: 1,
          signal: { _tag: "Limit", window: "5h", used: 0.9 },
        },
      },
      {
        _tag: "LinkMade",
        link: { kind: "forked", from: file("a"), to: file("b"), at: 1 },
      },
      {
        _tag: "PlanProposed",
        plan: {
          id: "p",
          agentId: main,
          at: 2,
          title: "Ship",
          steps: ["a"],
          status: "proposed",
        },
      },
      { _tag: "PlanDecided", id: "p", status: "approved" },
    ]);
    expect(run.readings).toHaveLength(1);
    expect(run.links).toHaveLength(1);
    expect(run.plans[0]?.status).toBe("approved");
  });
});
