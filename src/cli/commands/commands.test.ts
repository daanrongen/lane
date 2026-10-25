import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { RunSourceMemory } from "@/adapters/memory/RunSourceMemory.ts";
import { TaskRepositoryMemory } from "@/adapters/memory/TaskRepositoryMemory.ts";
import { ThreadRepositoryMemory } from "@/adapters/memory/ThreadRepositoryMemory.ts";
import { agentsLs } from "@/cli/commands/agents.ts";
import { attentionList } from "@/cli/commands/attention.ts";
import { statusOf } from "@/cli/commands/status.ts";
import { tasksLs } from "@/cli/commands/tasks.ts";
import { threadsLs, threadsShow } from "@/cli/commands/threads.ts";
import { type Out, render } from "@/cli/render.ts";
import type { RunEvent } from "@/domain/events.ts";
import { AgentId, SpanId, ThreadId } from "@/domain/ids.ts";
import { taskId } from "@/domain/task.ts";
import type { Thread } from "@/domain/thread.ts";
import { assetsOf } from "@/ports/Assets.ts";
import { type Harnesses, harness, harnessesOf } from "@/ports/Harness.ts";
import { ProcessProbe } from "@/ports/ProcessProbe.ts";
import { Runtimes } from "@/ports/Runtimes.ts";
import { Workspaces } from "@/ports/Workspaces.ts";

const main = AgentId("main");
const now = Date.now();

const thread = (id: string, over: Partial<Thread> = {}): Thread => ({
  harness: "claude",
  id: ThreadId(id),
  cwd: `/w/${id}`,
  status: "busy",
  updatedAt: now,
  name: id,
  ...over,
});

const events: RunEvent[] = [
  { _tag: "RunStarted", startedAt: now - 60_000 },
  {
    _tag: "AgentSpawned",
    agent: { id: main, parentId: null, name: "main" },
    at: 0,
  },
  {
    _tag: "SpanOpened",
    span: {
      _tag: "ToolCall",
      id: SpanId("t"),
      agentId: main,
      label: "bun test",
      tool: "Bash",
      failed: false,
      start: 50,
    },
  },
];

const task = (title: string, status: "next" | "doing" | "done") => ({
  id: taskId("todo", main, title),
  title,
  status,
  source: "todo" as const,
  owner: main,
  since: 10,
});

const layer = Layer.mergeAll(
  harnessesOf(
    harness(
      "claude",
      Layer.mergeAll(
        ThreadRepositoryMemory(() => [
          thread("a"),
          thread("b", { status: "past", updatedAt: 0 }),
        ]),
        RunSourceMemory({ a: events, b: events }),
        TaskRepositoryMemory({
          a: [
            task("write", "doing"),
            task("test", "next"),
            task("ship", "done"),
          ],
        }),
      ),
    ),
  ),
  assetsOf<never, never>(),
  ProcessProbe.none,
  Workspaces.flat,
  Runtimes.none,
);

type Needs = Harnesses | ProcessProbe | Runtimes | Workspaces;

const run = (answer: Effect.Effect<Out, unknown, Needs>) =>
  Effect.runPromise(answer.pipe(Effect.provide(layer), Effect.scoped));

const rows = async (answer: Effect.Effect<Out, unknown, Needs>) =>
  JSON.parse(render(await run(answer), "json"));

const base = { all: false, noProbe: true };
const threadOpts = { ...base };
const taskOpts = { ...base };
const agentOpts = { ...base };

describe("threads", () => {
  test("lists newest first and filters by status", async () => {
    const ids = (r: { id: string }[]) => r.map((x) => x.id);
    expect(ids(await rows(threadsLs(threadOpts, "/")))).toEqual(["a", "b"]);
    expect(
      ids(await rows(threadsLs({ ...threadOpts, past: true }, "/"))),
    ).toEqual(["b"]);
  });

  test("show reads one thread's run", async () => {
    const out = await run(threadsShow("a", base, "/"));
    expect("lines" in out && out.lines[0]).toContain("claude:a");
  });

  test("show fails for an unknown thread", async () => {
    await expect(run(threadsShow("nope", base, "/"))).rejects.toThrow();
  });
});

describe("tasks", () => {
  const titles = (r: { title: string }[]) => r.map((x) => x.title);

  test("shows what is doing and next, not what is done", async () => {
    const out = await rows(tasksLs("a", taskOpts, "/"));
    expect(titles(out)).toEqual(["write", "bun test", "test"]);
    expect(out.map((r: { status: string }) => r.status)).toEqual([
      "doing",
      "doing",
      "next",
    ]);
  });

  test("any status includes done", async () => {
    const out = await rows(tasksLs("a", { ...taskOpts, status: "any" }, "/"));
    expect(titles(out)).toContain("ship");
  });
});

describe("agents and status", () => {
  test("agents lists the live thread's agent", async () => {
    const out = await rows(agentsLs(agentOpts, "/"));
    expect(out.map((r: { agent: string }) => r.agent)).toContain(
      "claude:a:main",
    );
  });

  test("status counts agents by state", async () => {
    const out = await run(statusOf({ ...base, line: true }));
    expect("lines" in out && out.lines[0]).toContain("working");
  });

  test("attention lists what holds agents up", async () => {
    const out = await run(attentionList(base));
    expect("raw" in out).toBe(true);
  });
});
