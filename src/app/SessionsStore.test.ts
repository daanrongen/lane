import { describe, expect, test } from "bun:test";
import { Effect, Layer, Schedule, SubscriptionRef } from "effect";
import { SessionCatalogMemory } from "@/adapters/memory/SessionCatalogMemory.ts";
import { SessionsStore, SessionsStoreLive } from "@/app/SessionsStore.ts";
import { until } from "@/app/testing.ts";
import { SessionId } from "@/domain/ids.ts";
import type { Session } from "@/domain/session.ts";
import { SessionCatalog } from "@/ports/SessionCatalog.ts";
import { SourceError } from "@/ports/SourceError.ts";

const session = (id: string): Session => ({
  id: SessionId(id),
  cwd: "/x",
  pid: 1,
  status: "idle",
  updatedAt: 0,
});

const poll = Schedule.spaced("10 millis");
const run = <A, E>(
  self: Effect.Effect<A, E, SessionsStore>,
  catalog: Layer.Layer<SessionCatalog>,
) =>
  Effect.runPromise(
    self.pipe(
      Effect.provide(SessionsStoreLive(poll).pipe(Layer.provide(catalog))),
      Effect.scoped,
    ),
  );

describe("SessionsStore", () => {
  test("follows the catalog as it changes", () => {
    let current = [session("a")];
    return run(
      Effect.gen(function* () {
        const { sessions } = yield* SessionsStore;
        const read = SubscriptionRef.get(sessions);
        yield* until(read, (s) => s.length === 1);
        current = [session("a"), session("b")];
        const seen = yield* until(read, (s) => s.length === 2);
        expect(seen.map((s) => s.id)).toEqual([SessionId("a"), SessionId("b")]);
      }),
      SessionCatalogMemory(() => current),
    );
  });

  test("a failed poll keeps the last known sessions", () => {
    let calls = 0;
    const flaky = Layer.succeed(SessionCatalog, {
      list: Effect.suspend(() =>
        ++calls === 1
          ? Effect.succeed([session("a")])
          : Effect.fail(new SourceError({ message: "boom" })),
      ),
    });
    return run(
      Effect.gen(function* () {
        const { sessions } = yield* SessionsStore;
        const read = SubscriptionRef.get(sessions);
        yield* until(read, (s) => s.length === 1);
        yield* Effect.sleep("60 millis");
        expect(calls).toBeGreaterThan(2);
        expect(yield* read).toHaveLength(1);
      }),
      flaky,
    );
  });
});
