import { describe, expect, test } from "bun:test";
import { board } from "@/domain/board.ts";
import { AgentId, SessionId, SpanId } from "@/domain/ids.ts";
import { emptyRun, type Run } from "@/domain/run.ts";
import { type Task, taskId } from "@/domain/task.ts";

const main = AgentId("main");
const kid = AgentId("kid");
const task = (
  source: Task["source"],
  title: string,
  status: Task["status"],
  since = 0,
): Task => ({
  id: taskId(source, main, title),
  title,
  status,
  source,
  owner: main,
  since,
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
    expect(board(run(base), []).doing.map((c) => [c.title, c.source])).toEqual([
      ["scan the repo", "agent"],
    ]);
    const done = board(
      run({ ...base, finishes: [{ agentId: kid, at: 9 }] }),
      [],
    );
    expect(done.done.map((c) => [c.title, c.since])).toEqual([
      ["scan the repo", 9],
    ]);
  });

  test("task lists are split by status", () => {
    const b = board(run({}), [
      task("todo", "a", "done", 5),
      task("todo", "b", "doing", 5),
      task("queue", "c", "next"),
    ]);
    expect(b.done.map((c) => c.title)).toEqual(["a"]);
    expect(b.doing.map((c) => c.title)).toEqual(["b"]);
    expect(b.next.map((c) => c.title)).toEqual(["c"]);
  });

  test("an explicit task list replaces the plan's steps", () => {
    const both = board(run({}), [
      task("plan", "step", "next"),
      task("todo", "real", "next"),
    ]);
    expect(both.next.map((c) => c.title)).toEqual(["real"]);
    expect(board(run({}), [task("plan", "step", "next")]).next).toHaveLength(1);
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
      [],
    );
    expect(b.doing.map((c) => [c.title, c.source])).toEqual([
      ["bun test", "now"],
    ]);
  });
});
