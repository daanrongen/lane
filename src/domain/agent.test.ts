import { describe, expect, test } from "bun:test";
import { stateOf, summarise, THRESHOLDS } from "@/domain/agent.ts";
import { attentionOf } from "@/domain/attention.ts";
import type { RunEvent } from "@/domain/events.ts";
import { foldAll } from "@/domain/fold.ts";
import { ActId, AgentId, SpanId, ThreadId } from "@/domain/ids.ts";
import { insightsOf } from "@/domain/insight.ts";
import { emptyRun } from "@/domain/run.ts";
import { type Task, taskId } from "@/domain/task.ts";

const main = AgentId("main");
const sub = AgentId("sub");

const root: RunEvent = {
  _tag: "AgentSpawned",
  agent: { id: main, parentId: null, name: "main" },
  at: 0,
};
const child: RunEvent = {
  _tag: "AgentSpawned",
  agent: { id: sub, parentId: main, name: "explore" },
  at: 1,
};

const open = (
  id: string,
  tool: string,
  start: number,
  agentId = main,
  label = tool,
): RunEvent => ({
  _tag: "SpanOpened",
  span: {
    _tag: "ToolCall",
    id: SpanId(id),
    agentId,
    label,
    tool,
    failed: false,
    start,
  },
});
const close = (
  id: string,
  at: number,
  failed = false,
  reason?: string,
): RunEvent => ({
  _tag: "SpanClosed",
  spanId: SpanId(id),
  at,
  failed,
  reason,
});
const finish = (at: number, agentId = main): RunEvent => ({
  _tag: "AgentFinished",
  agentId,
  at,
});

const summary = (events: RunEvent[], who = main) => {
  const run = foldAll(emptyRun(ThreadId("t"), 0), [root, child, ...events]);
  const found = summarise(run, []).find((s) => s.agent.id === who);
  if (!found) throw new Error("no agent");
  return found;
};

describe("stateOf", () => {
  test("a recent open call is working, a very old one is stalled", () => {
    const s = summary([open("a", "Bash", 100)]);
    expect(stateOf(s, 110, true)).toBe("working");
    expect(stateOf(s, 100 + THRESHOLDS.hung, true)).toBe("stalled");
  });

  test("an open ask or plan needs you, even if it is old", () => {
    expect(
      stateOf(summary([open("q", "AskUserQuestion", 1)]), 5000, true),
    ).toBe("needs-you");
    expect(stateOf(summary([open("p", "ExitPlanMode", 1)]), 5, true)).toBe(
      "needs-you",
    );
  });

  test("waiting on a child while only a spawn is open", () => {
    const run = foldAll(emptyRun(ThreadId("t"), 0), [
      root,
      {
        _tag: "SpanOpened",
        span: {
          _tag: "Waiting",
          id: SpanId("w"),
          agentId: main,
          label: "explore",
          start: 2,
          on: sub,
        },
      },
      child,
    ]);
    const s = summarise(run, [])[0];
    expect(s && stateOf(s, 10, true)).toBe("waiting");
  });

  test("a hook that blocked a call does not make the agent failed", () => {
    const s = summary([
      open("a", "Read", 1),
      close("a", 2),
      {
        _tag: "ActOpened",
        act: {
          id: ActId("hook:1"),
          agentId: main,
          kind: "tool",
          tool: "hook",
          label: "guard",
          start: 3,
          end: 3,
          status: "failed",
          touches: [],
          fidelity: "observed",
        },
      },
    ]);
    expect(stateOf(s, 4, true)).toBe("working");
    expect(s.failed).toBe(1);
  });

  test("silence after a finished turn is idle, silence mid-turn is stalled", () => {
    const done = summary([open("a", "Read", 1), close("a", 2), finish(3)]);
    expect(stateOf(done, 9999, true)).toBe("idle");
    const mid = summary([open("a", "Read", 1), close("a", 2)]);
    expect(stateOf(mid, 2 + THRESHOLDS.stalled, true)).toBe("stalled");
    expect(stateOf(mid, 10, true)).toBe("working");
  });

  test("a finished sub-agent is done, and a dead thread is done unless it failed", () => {
    const sa = summary(
      [open("a", "Read", 2, sub), close("a", 3, false), finish(4, sub)],
      sub,
    );
    expect(stateOf(sa, 99, true)).toBe("done");
    expect(
      stateOf(summary([open("a", "Read", 1), close("a", 2)]), 99, false),
    ).toBe("done");
    expect(
      stateOf(
        summary([open("a", "Bash", 1), close("a", 2, true, "boom")]),
        99,
        false,
      ),
    ).toBe("failed");
  });

  test("a failure with nothing after it is failed, a later call clears it", () => {
    const failed = summary([open("a", "Bash", 1), close("a", 2, true, "boom")]);
    expect(stateOf(failed, 3, true)).toBe("failed");
    const recovered = summary([
      open("a", "Bash", 1),
      close("a", 2, true),
      open("b", "Bash", 3),
      close("b", 4),
    ]);
    expect(stateOf(recovered, 5, true)).toBe("working");
  });

  test("an agent that has done nothing yet is idle", () => {
    expect(stateOf(summary([]), 9999, true)).toBe("idle");
  });
});

describe("attention", () => {
  test("approvals, questions and plans are told apart", () => {
    const s = summary([
      open("q", "AskUserQuestion", 1),
      open("p", "ExitPlanMode", 2),
    ]);
    expect(attentionOf(s, "needs-you").map((a) => a.reason)).toEqual([
      "question",
      "plan",
    ]);
  });

  test("a failed or stalled agent says so", () => {
    const s = summary([open("a", "Bash", 1), close("a", 2, true, "boom")]);
    expect(attentionOf(s, "failed")).toMatchObject([
      { reason: "failed", label: "boom" },
    ]);
    expect(attentionOf(s, "stalled").map((a) => a.reason)).toContain("stalled");
  });

  test("a rate limit failure raises attention and an insight", () => {
    const s = summary([
      open("a", "Bash", 1),
      close("a", 2, true, "429 Too Many Requests"),
    ]);
    expect(attentionOf(s, "failed").map((a) => a.reason)).toContain(
      "rate-limit",
    );
    expect(insightsOf(s)).toContain("rate-limited");
  });
});

describe("insights", () => {
  test("the same call four times in a row is a loop", () => {
    const events = [1, 2, 3, 4].flatMap((i): RunEvent[] => [
      open(`a${i}`, "Bash", i, main, "bun test"),
      close(`a${i}`, i + 0.5),
    ]);
    expect(insightsOf(summary(events))).toContain("loop");
  });

  test("three failures in the last five calls is a retry storm", () => {
    const events = [1, 2, 3].flatMap((i): RunEvent[] => [
      open(`a${i}`, "Bash", i, main, `try ${i}`),
      close(`a${i}`, i + 0.5, true),
    ]);
    expect(insightsOf(summary(events))).toContain("retry-storm");
  });

  test("a clean run has none", () => {
    expect(insightsOf(summary([open("a", "Read", 1), close("a", 2)]))).toEqual(
      [],
    );
  });
});

describe("next", () => {
  const t = (source: Task["source"], title: string, status: Task["status"]) =>
    ({
      id: taskId(source, main, title),
      title,
      status,
      source,
      owner: main,
      since: 0,
    }) as Task;
  const run = foldAll(emptyRun(ThreadId("t"), 0), [root]);

  test("the todo list is picked up before the queue, and done work is skipped", () => {
    const tasks = [
      t("queue", "docs", "next"),
      t("todo", "tests", "done"),
      t("todo", "migrate", "next"),
    ];
    expect(summarise(run, tasks)[0]?.next).toBe("migrate");
    expect(summarise(run, tasks.slice(0, 2))[0]?.next).toBe("docs");
    expect(summarise(run, tasks.slice(1, 2))[0]?.next).toBeUndefined();
  });

  test("with one doing and several pending, next is the first pending and progress counts all", () => {
    const tasks = [
      t("todo", "a", "doing"),
      t("todo", "b", "next"),
      t("todo", "c", "next"),
    ];
    const s = summarise(run, tasks)[0];
    expect(s?.next).toBe("b");
    expect(s?.progress).toEqual({ done: 0, total: 3 });
  });
});
