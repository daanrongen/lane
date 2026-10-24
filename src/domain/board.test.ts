import { describe, expect, test } from "bun:test";
import { board } from "@/domain/board.ts";
import { AgentId, SessionId, SpanId } from "@/domain/ids.ts";
import { emptyRun, type Plan, type Run } from "@/domain/run.ts";

const main = AgentId("main");
const kid = AgentId("kid");
const plan = (
  at: number,
  source: Plan["source"],
  items: [string, "next" | "doing" | "done"][],
): Plan => ({
  agentId: main,
  at,
  source,
  items: items.map(([title, status]) => ({ title, status })),
});
const run = (extra: Partial<Run>): Run => ({
  ...emptyRun(SessionId("s"), 0),
  ...extra,
});

describe("board", () => {
  test("a spawned agent is doing until it finishes, then done", () => {
    const base = {
      agents: [
        { id: main, parentId: null, name: "main" },
        { id: kid, parentId: main, name: "Explore" },
      ],
      handoffs: [{ from: main, to: kid, at: 2 }],
      spans: [
        {
          _tag: "Waiting",
          id: SpanId("w"),
          agentId: main,
          label: "scan the repo",
          start: 2,
          end: 9,
          on: kid,
        } as const,
      ],
    };
    expect(board(run(base)).doing.map((c) => [c.title, c.source])).toEqual([
      ["scan the repo", "agent"],
    ]);
    const done = board(run({ ...base, finishes: [{ agentId: kid, at: 9 }] }));
    expect(done.done.map((c) => [c.title, c.since])).toEqual([
      ["scan the repo", 9],
    ]);
  });

  test("a task list is split by status, and each item remembers when it got there", () => {
    const b = board(
      run({
        plans: [
          plan(1, "todo", [
            ["a", "doing"],
            ["b", "next"],
          ]),
          plan(5, "todo", [
            ["a", "done"],
            ["b", "doing"],
          ]),
        ],
      }),
    );
    expect(b.done.map((c) => [c.title, c.since])).toEqual([["a", 5]]);
    expect(b.doing.map((c) => [c.title, c.since])).toEqual([["b", 5]]);
  });

  test("an explicit task list replaces the plan's steps", () => {
    const both = board(
      run({
        plans: [
          plan(1, "plan", [["step", "next"]]),
          plan(2, "todo", [["real", "next"]]),
        ],
      }),
    );
    expect(both.next.map((c) => c.title)).toEqual(["real"]);
    expect(
      board(run({ plans: [plan(1, "plan", [["step", "next"]])] })).next,
    ).toHaveLength(1);
  });

  test("an open call is what the agent is doing now", () => {
    const b = board(
      run({
        spans: [
          {
            _tag: "ToolCall",
            id: SpanId("t"),
            agentId: main,
            label: "bun test",
            tool: "Bash",
            failed: false,
            start: 7,
          },
        ],
      }),
    );
    expect(b.doing.map((c) => [c.title, c.source])).toEqual([
      ["bun test", "now"],
    ]);
  });
});
