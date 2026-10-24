import { describe, expect, test } from "bun:test";
import { Effect, SubscriptionRef } from "effect";
import { RunSourceMemory } from "@/adapters/memory/RunSourceMemory.ts";
import { demoEvents, demoSession } from "@/app/demo.ts";
import { openRun } from "@/app/openRun.ts";
import { until } from "@/app/testing.ts";
import { foldAll } from "@/domain/fold.ts";
import { SessionId } from "@/domain/ids.ts";
import { emptyRun } from "@/domain/run.ts";

const id = demoSession.id;
const source = RunSourceMemory({ [id]: demoEvents });

const run = <A, E>(
  self: Effect.Effect<
    A,
    E,
    import("@/ports/RunSource.ts").RunSource | import("effect").Scope.Scope
  >,
) => Effect.runPromise(self.pipe(Effect.provide(source), Effect.scoped));

describe("openRun", () => {
  test("folds the event stream into the run, then ends", () =>
    run(
      Effect.gen(function* () {
        const open = yield* openRun(id);
        yield* until(SubscriptionRef.get(open.status), (s) => s !== "reading");
        expect(yield* SubscriptionRef.get(open.status)).toBe("ended");
        expect(yield* SubscriptionRef.get(open.run)).toEqual(
          foldAll(emptyRun(id, 0), demoEvents),
        );
      }),
    ));

  test("an unknown session is marked failed", () =>
    run(
      Effect.gen(function* () {
        const open = yield* openRun(SessionId("nope"));
        const status = yield* until(
          SubscriptionRef.get(open.status),
          (s) => s !== "reading",
        );
        expect(status).toBe("failed");
      }),
    ));
});
