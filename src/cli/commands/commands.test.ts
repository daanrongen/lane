import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { assetReaderMemory } from "@/adapters/memory/AssetReaderMemory.ts";
import { RunSourceMemory } from "@/adapters/memory/RunSourceMemory.ts";
import { TaskRepositoryMemory } from "@/adapters/memory/TaskRepositoryMemory.ts";
import { ThreadRepositoryMemory } from "@/adapters/memory/ThreadRepositoryMemory.ts";
import { actsList } from "@/cli/commands/acts.ts";
import { agentsLs } from "@/cli/commands/agents.ts";
import { assetsList } from "@/cli/commands/assets.ts";
import { attentionList } from "@/cli/commands/attention.ts";
import { contextShow } from "@/cli/commands/context.ts";
import { doctorChecks } from "@/cli/commands/doctor.ts";
import { feedList } from "@/cli/commands/feed.ts";
import { filesList, treeShow } from "@/cli/commands/files.ts";
import { harnessMatrix } from "@/cli/commands/harnesses.ts";
import { planShow } from "@/cli/commands/plan.ts";
import { modelsList, skillsList } from "@/cli/commands/rollups.ts";
import { statusOf } from "@/cli/commands/status.ts";
import { tasksLs } from "@/cli/commands/tasks.ts";
import { threadsLs, threadsShow } from "@/cli/commands/threads.ts";
import { usageBy } from "@/cli/commands/usage.ts";
import { type Out, render } from "@/cli/render.ts";
import type { RunEvent } from "@/domain/events.ts";
import { ActId, AgentId, SpanId, ThreadId } from "@/domain/ids.ts";
import { file } from "@/domain/ref.ts";
import { taskId } from "@/domain/task.ts";
import type { Thread } from "@/domain/thread.ts";
import { type Assets, assetsOf } from "@/ports/Assets.ts";
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
    _tag: "TurnReported",
    turn: {
      agentId: main,
      at: 5,
      model: "claude-x",
      usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0 },
    },
  },
  {
    _tag: "ActOpened",
    act: {
      id: ActId("e1"),
      agentId: main,
      kind: "edit",
      label: "Edit x.ts",
      start: 20,
      end: 21,
      status: "ok",
      touches: [file("/w/a/x.ts")],
      fidelity: "observed",
    },
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
  assetsOf(
    assetReaderMemory("t", [
      { _tag: "Skill", source: "t", name: "deploy", description: "ship it" },
      { _tag: "Mcp", source: "t", name: "gh", transport: "stdio" },
    ]),
  ),
  ProcessProbe.none,
  Workspaces.flat,
  Runtimes.none,
);

type Needs = Harnesses | ProcessProbe | Runtimes | Workspaces | Assets;

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

describe("activity", () => {
  test("feed lists what agents did and filters by kind and touched file", async () => {
    const all = await rows(feedList({ ...base }, "/"));
    expect(all.map((r: { label: string }) => r.label)).toContain("Edit x.ts");
    const edits = await rows(feedList({ ...base, kind: "edit" }, "/"));
    expect(edits.every((r: { kind: string }) => r.kind === "edit")).toBe(true);
    const touching = await rows(feedList({ ...base, touching: "x.ts" }, "/"));
    expect(touching.length).toBeGreaterThan(0);
  });

  test("acts hides thinking and can show only failures", async () => {
    const acts = await rows(
      actsList("a", { noProbe: true, failed: false, awaiting: false }, "/"),
    );
    expect(acts.map((r: { label: string }) => r.label)).toContain("Edit x.ts");
    const failed = await rows(
      actsList("a", { noProbe: true, failed: true, awaiting: false }, "/"),
    );
    expect(failed).toEqual([]);
  });

  test("files and tree show what was touched", async () => {
    const edited = await rows(
      filesList({ ...base, edited: true, shared: false }, "/"),
    );
    expect(edited.map((r: { file: string }) => r.file)).toEqual(["/w/a/x.ts"]);
    const out = await run(treeShow("/w/a", base, "/"));
    expect("lines" in out && out.lines.join("\n")).toContain("x.ts");
  });

  test("usage groups tokens by model and harness", async () => {
    const byModel = await rows(usageBy("model", base, "/"));
    expect(byModel[0]).toMatchObject({ model: "claude-x", output: 20 });
    const byHarness = await rows(usageBy("harness", base, "/"));
    expect(byHarness[0]).toMatchObject({ harness: "claude" });
  });

  test("plan and context answer for a thread", async () => {
    const out = await run(planShow("a", { noProbe: true }, "/"));
    expect("lines" in out && out.lines[0]).toBe("no plan proposed");
    const cells = await rows(contextShow("a", { noProbe: true }, "/"));
    expect(cells.at(-1)).toMatchObject({ kind: "Free" });
  });
});

describe("catalog", () => {
  test("assets lists setup and filters by kind", async () => {
    const all = await rows(assetsList({}, "/"));
    expect(all).toHaveLength(2);
    const mcp = await rows(assetsList({ kind: "mcp" }, "/"));
    expect(mcp.map((r: { name: string }) => r.name)).toEqual(["gh"]);
  });

  test("models roll up across threads", async () => {
    const out = await rows(modelsList(undefined, { ...base }, "/"));
    expect(out[0]).toMatchObject({ model: "claude-x", turns: 1 });
    expect(await rows(skillsList("a", { ...base }, "/"))).toEqual([]);
  });

  test("harnesses lists every facet with n/a for none", async () => {
    const out = await run(harnessMatrix);
    expect("raw" in out && out.raw.length).toBeGreaterThan(10);
    expect("shown" in out && out.shown[0]?.[1]).toBe("n/a");
  });

  test("doctor reports the harness and no failure", async () => {
    const out = await run(doctorChecks);
    const { checks } = (out as { data: { checks: { status: string }[] } }).data;
    expect(checks.some((c) => c.status === "fail")).toBe(false);
  });
});
