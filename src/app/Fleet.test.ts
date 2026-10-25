import { describe, expect, test } from "bun:test";
import { Effect, Layer, Schedule, SubscriptionRef } from "effect";
import { assetReaderMemory } from "@/adapters/memory/AssetReaderMemory.ts";
import { RunSourceMemory } from "@/adapters/memory/RunSourceMemory.ts";
import { TaskRepositoryMemory } from "@/adapters/memory/TaskRepositoryMemory.ts";
import { ThreadRepositoryMemory } from "@/adapters/memory/ThreadRepositoryMemory.ts";
import { Fleet, FleetLive, pick } from "@/app/Fleet.ts";
import { SessionsStoreLive } from "@/app/SessionsStore.ts";
import { until } from "@/app/testing.ts";
import type { RunEvent } from "@/domain/events.ts";
import { AgentId, SpanId, ThreadId } from "@/domain/ids.ts";
import type { RawProcess } from "@/domain/presence.ts";
import type { Thread } from "@/domain/thread.ts";
import { assetsOf } from "@/ports/Assets.ts";
import { harness, harnessesOf } from "@/ports/Harness.ts";
import { ProcessProbe } from "@/ports/ProcessProbe.ts";
import { Workspaces } from "@/ports/Workspaces.ts";

const main = AgentId("main");
const poll = Schedule.spaced("10 millis");

const thread = (id: string, over: Partial<Thread> = {}): Thread => ({
  harness: "claude",
  id: ThreadId(id),
  cwd: `/w/${id}`,
  status: "busy",
  updatedAt: Date.now(),
  name: id,
  ...over,
});

const events = (start: number): RunEvent[] => [
  { _tag: "RunStarted", startedAt: start },
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
      start: 5,
    },
  },
];

const run = <A, E>(
  self: Effect.Effect<A, E, Fleet>,
  opts: { threads: Thread[]; procs?: RawProcess[] },
) =>
  Effect.runPromise(
    self.pipe(
      Effect.provide(
        FleetLive({ tick: poll, setupRefresh: poll }).pipe(
          Layer.provideMerge(SessionsStoreLive(poll)),
          Layer.provideMerge(
            harnessesOf(
              harness(
                "claude",
                Layer.mergeAll(
                  ThreadRepositoryMemory(() => opts.threads),
                  RunSourceMemory(
                    Object.fromEntries(
                      opts.threads.map((t) => [
                        t.id,
                        events(Date.now() - 10_000),
                      ]),
                    ),
                  ),
                  TaskRepositoryMemory({}),
                ),
              ),
            ),
          ),
          Layer.provideMerge(
            assetsOf(
              assetReaderMemory("demo", [
                { _tag: "Skill", source: "demo", name: "pdf", description: "" },
              ]),
            ),
          ),
          Layer.provideMerge(
            Layer.succeed(ProcessProbe, {
              find: () => Effect.succeed(opts.procs ?? []),
            }),
          ),
          Layer.provideMerge(Workspaces.flat),
        ),
      ),
      Effect.scoped,
    ),
  );

describe("pick", () => {
  const at = 1_000_000;
  const t = (id: string, status: Thread["status"], ago: number) =>
    thread(id, { status, updatedAt: at - ago });

  test("live threads lead, quiet ones age out, and only so many are kept", () => {
    const picked = pick(
      [t("old", "past", 2_000), t("live", "busy", 5_000), t("new", "past", 10)],
      at,
      { recent: 1_000, cap: 2 },
    );
    expect(picked.map((x) => x.id)).toEqual([
      ThreadId("live"),
      ThreadId("new"),
    ]);
  });
});

describe("Fleet", () => {
  test("a live thread shows as an agent doing what its run says", () =>
    run(
      Effect.gen(function* () {
        const { floor } = yield* Fleet;
        const seen = yield* until(
          SubscriptionRef.get(floor),
          (f) => f.agents.length === 1,
        );
        expect(seen.agents[0]).toMatchObject({
          name: "a",
          state: "working",
          workspace: "/w/a",
          now: { label: "bun test" },
        });
        expect(seen.workspaces[0]?.agents).toHaveLength(1);
      }),
      { threads: [thread("a")] },
    ));

  test("a thread long quiet is left off the floor", () =>
    run(
      Effect.gen(function* () {
        const { floor } = yield* Fleet;
        yield* until(SubscriptionRef.get(floor), (f) => f.agents.length === 1);
        yield* Effect.sleep("60 millis");
        expect(
          (yield* SubscriptionRef.get(floor)).agents.map((a) => a.name),
        ).toEqual(["live"]);
      }),
      {
        threads: [
          thread("live"),
          thread("gone", { status: "past", updatedAt: 0 }),
        ],
      },
    ));

  test("a process no thread explains is an agent of its own", () =>
    run(
      Effect.gen(function* () {
        const { floor } = yield* Fleet;
        const seen = yield* until(SubscriptionRef.get(floor), (f) =>
          f.agents.some((a) => a.origin === "process"),
        );
        expect(seen.agents.find((a) => a.origin === "process")).toMatchObject({
          harness: "ollama",
          name: "ollama",
          workspace: "/w/lab",
          state: "idle",
        });
      }),
      {
        threads: [],
        procs: [{ pid: 9, command: "ollama run gemma", cwd: "/w/lab" }],
      },
    ));

  test("setup is read once per workspace on the floor", () =>
    run(
      Effect.gen(function* () {
        const { setups } = yield* Fleet;
        const seen = yield* until(
          SubscriptionRef.get(setups),
          (s) => Object.keys(s).length === 1,
        );
        expect(seen["/w/a"]?.[0]).toMatchObject({ _tag: "Skill", name: "pdf" });
      }),
      { threads: [thread("a")] },
    ));

  test("profiles list every harness", () =>
    run(
      Effect.gen(function* () {
        expect((yield* Fleet).profiles.map((p) => p.id)).toEqual(["claude"]);
      }),
      { threads: [] },
    ));
});
