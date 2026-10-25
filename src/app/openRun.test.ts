import { describe, expect, test } from "bun:test";
import { Effect, Layer, type Scope, SubscriptionRef } from "effect";
import { RunSourceMemory } from "@/adapters/memory/RunSourceMemory.ts";
import {
  demoEvents,
  demoSession,
  demoTasks,
} from "@/adapters/memory/scenario/fixtures.ts";
import { TaskRepositoryMemory } from "@/adapters/memory/TaskRepositoryMemory.ts";
import { ThreadRepositoryMemory } from "@/adapters/memory/ThreadRepositoryMemory.ts";
import { openRun } from "@/app/openRun.ts";
import { until } from "@/app/testing.ts";
import { foldAll } from "@/domain/fold.ts";
import { ThreadId } from "@/domain/ids.ts";
import { emptyRun } from "@/domain/run.ts";
import { type Harnesses, harness, harnessesOf } from "@/ports/Harness.ts";

const id = demoSession.id;
const source = harnessesOf(
  harness(
    "claude",
    Layer.mergeAll(
      ThreadRepositoryMemory(() => [demoSession]),
      RunSourceMemory({ [id]: demoEvents }),
      TaskRepositoryMemory({ [id]: demoTasks }),
    ),
  ),
);

const run = <A, E>(self: Effect.Effect<A, E, Harnesses | Scope.Scope>) =>
  Effect.runPromise(self.pipe(Effect.provide(source), Effect.scoped));

describe("openRun", () => {
  test("folds the event stream into the run, then ends", () =>
    run(
      Effect.gen(function* () {
        const open = yield* openRun(demoSession);
        yield* until(SubscriptionRef.get(open.status), (s) => s !== "reading");
        expect(yield* SubscriptionRef.get(open.status)).toBe("ended");
        expect(yield* SubscriptionRef.get(open.run)).toEqual(
          foldAll(emptyRun(id, 0), demoEvents),
        );
        const tasks = yield* until(
          SubscriptionRef.get(open.tasks),
          (t) => t.length > 0,
        );
        expect(tasks).toEqual(demoTasks);
      }),
    ));

  test("an unknown session is marked failed", () =>
    run(
      Effect.gen(function* () {
        const open = yield* openRun({ ...demoSession, id: ThreadId("nope") });
        const status = yield* until(
          SubscriptionRef.get(open.status),
          (s) => s !== "reading",
        );
        expect(status).toBe("failed");
      }),
    ));
});
