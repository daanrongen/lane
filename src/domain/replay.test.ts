import { describe, expect, test } from "bun:test";
import { AgentId, SpanId, ThreadId } from "@/domain/ids.ts";
import { lastAt, runAt } from "@/domain/replay.ts";
import { emptyRun, type Run, type Span } from "@/domain/run.ts";

const main = AgentId("main");
const sub = AgentId("sub");
const call = (
  id: string,
  start: number,
  end?: number,
  agentId = main,
): Span => ({
  _tag: "ToolCall",
  id: SpanId(id),
  agentId,
  label: id,
  tool: "Bash",
  failed: false,
  start,
  end,
});

const run: Run = {
  ...emptyRun(ThreadId("t"), 0),
  agents: [
    { id: main, parentId: null, name: "main" },
    { id: sub, parentId: main, name: "sub" },
  ],
  spans: [call("a", 1, 4), call("b", 6, 9), call("c", 7, 8, sub)],
  turns: [
    {
      agentId: main,
      at: 5,
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
    },
  ],
};

describe("replay", () => {
  test("the end is the last thing that happened", () => {
    expect(lastAt(run)).toBe(9);
  });

  test("later spans are gone and a span still going is open", () => {
    const at = runAt(run, 7.5);
    expect(at.spans.map((s) => [s.id, s.end])).toEqual([
      [SpanId("a"), 4],
      [SpanId("b"), undefined],
      [SpanId("c"), undefined],
    ]);
    expect(runAt(run, 5).turns).toHaveLength(1);
    expect(runAt(run, 4.9).turns).toHaveLength(0);
  });

  test("a sub-agent appears when it first acts, the root always", () => {
    expect(runAt(run, 3).agents.map((a) => a.id)).toEqual([main]);
    expect(runAt(run, 7).agents.map((a) => a.id)).toEqual([main, sub]);
  });
});
