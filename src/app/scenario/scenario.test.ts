import { describe, expect, test } from "bun:test";
import { Effect, Layer, Schedule, SubscriptionRef } from "effect";
import { assetReaderMemory } from "@/adapters/memory/AssetReaderMemory.ts";
import { ollamaProfile } from "@/adapters/ollama/profile.ts";
import { Fleet, FleetLive } from "@/app/Fleet.ts";
import { SessionsStoreLive } from "@/app/SessionsStore.ts";
import { scenario } from "@/app/scenario/machine.ts";
import {
  aiderStories,
  claudeStories,
  codexStories,
  geminiStories,
} from "@/app/scenario/stories.ts";
import { until } from "@/app/testing.ts";
import { foldAll } from "@/domain/fold.ts";
import { ThreadId } from "@/domain/ids.ts";
import { emptyRun } from "@/domain/run.ts";
import { assetsOf } from "@/ports/Assets.ts";

const stories = [
  ...claudeStories,
  ...codexStories,
  ...geminiStories,
  ...aiderStories,
];

const played = (key: string) => {
  const story = stories.find((s) => s.key === key);
  if (!story) throw new Error(`no story ${key}`);
  const beats = story.beats((k) => ThreadId(`${k}#0`));
  return foldAll(
    emptyRun(ThreadId(key), 0),
    [...beats].sort((a, b) => a.at - b.at).map((b) => b.event),
  );
};

describe("stories", () => {
  test("a hook and a classifier each stop a call", () => {
    const acts = played("fork").acts;
    expect(acts.some((a) => a.failure?.class === "hook")).toBe(true);
    expect(
      acts.some(
        (a) => a.status === "denied" && a.approval?.by === "classifier",
      ),
    ).toBe(true);
  });

  test("a person's approval is recorded with how long it waited", () => {
    const acts = played("button").acts;
    expect(acts.some((a) => a.approval?.waited === 90)).toBe(true);
    expect(acts.at(-1)?.status).toBe("awaiting");
  });

  test("a plan is proposed and later approved", () => {
    expect(played("pricing").plans.map((p) => p.status)).toEqual(["approved"]);
  });

  test("threads are linked as resumed, forked and worktree", () => {
    const kinds = ["billing", "fork", "pricing"].flatMap((k) =>
      played(k).links.map((l) => l.kind),
    );
    expect(kinds).toEqual(["resumed", "forked", "worktree-of"]);
  });

  test("a context fills and is then compacted", () => {
    const run = played("fork");
    expect(run.acts.some((a) => a.kind === "compact")).toBe(true);
    expect(run.turns.map((t) => t.usage.cacheRead).at(-1)).toBeLessThan(
      run.turns[0]?.usage.cacheRead ?? 0,
    );
  });

  test("a quota is reported", () => {
    expect(played("button").readings.map((r) => r.signal._tag)).toContain(
      "Limit",
    );
  });
});

describe("the floor", () => {
  const poll = Schedule.spaced("10 millis");
  const demo = scenario();
  const run = Effect.gen(function* () {
    const fleet = yield* Fleet;
    return yield* until(
      SubscriptionRef.get(fleet.floor),
      (f) => f.agents.length >= 14 && f.runtimes.length > 0,
    );
  }).pipe(
    Effect.provide(
      FleetLive({
        tick: poll,
        setupRefresh: poll,
        profiles: [ollamaProfile],
      }).pipe(
        Layer.provideMerge(SessionsStoreLive(poll)),
        Layer.provideMerge(demo.harnesses),
        Layer.provideMerge(assetsOf(assetReaderMemory("demo", []))),
        Layer.provideMerge(demo.probe),
        Layer.provideMerge(demo.workspaces),
        Layer.provideMerge(demo.runtimes),
      ),
    ),
    Effect.scoped,
  );

  test("shows every kind of attention, insight and state at once", async () => {
    const floor = await Effect.runPromise(run);
    const reasons = new Set<string>(floor.attention.map((a) => a.reason));
    const insights = new Set<string>(floor.insights.map((i) => i.kind));
    expect([...reasons].sort()).toEqual(
      ["approval", "failed", "plan", "rate-limit", "stalled"].sort(),
    );
    expect([...insights].sort()).toEqual(
      ["collision", "loop", "near-full", "rate-limited", "retry-storm"].sort(),
    );
    const states = new Set(floor.agents.map((a) => a.state));
    for (const s of [
      "working",
      "waiting",
      "needs-you",
      "stalled",
      "failed",
      "done",
      "idle",
    ]) {
      expect(states.has(s as never)).toBe(true);
    }
  });

  test("groups agents of several harnesses by workspace", async () => {
    const floor = await Effect.runPromise(run);
    expect(floor.workspaces.map((w) => w.branch).sort()).toEqual(
      ["feat/billing", "feat/pricing", "main", "main", "main"].sort(),
    );
    const harnesses = new Set(floor.agents.map((a) => a.harness));
    expect([...harnesses].sort()).toEqual(
      ["aider", "claude", "codex", "gemini", "ollama"].sort(),
    );
  });

  test("a local model's runtime lists the agents using it", async () => {
    const floor = await Effect.runPromise(run);
    const [ollama] = floor.runtimes;
    expect(ollama?.models.map((m) => m.name)).toEqual([
      "gpt-oss:20b",
      "granite4",
    ]);
    expect(ollama?.usedBy.length).toBe(1);
    expect(floor.agents.some((a) => a.origin === "process")).toBe(true);
  });

  test("the earlier conversation is history, not on the floor", async () => {
    const floor = await Effect.runPromise(run);
    expect(floor.agents.some((a) => a.name === "billing-spike")).toBe(false);
  });
});
