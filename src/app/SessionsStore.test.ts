import { describe, expect, test } from "bun:test";
import { Effect, Layer, Schedule, SubscriptionRef } from "effect";
import { RunSourceMemory } from "@/adapters/memory/RunSourceMemory.ts";
import { TaskRepositoryMemory } from "@/adapters/memory/TaskRepositoryMemory.ts";
import { ThreadRepositoryMemory } from "@/adapters/memory/ThreadRepositoryMemory.ts";
import { SessionsStore, SessionsStoreLive } from "@/app/SessionsStore.ts";
import { until } from "@/app/testing.ts";
import { ThreadId } from "@/domain/ids.ts";
import type { Thread } from "@/domain/thread.ts";
import { harness, harnessesOf } from "@/ports/Harness.ts";
import { SourceError } from "@/ports/SourceError.ts";
import { ThreadRepository } from "@/ports/ThreadRepository.ts";

const session = (id: string): Thread => ({
  harness: "claude",
  id: ThreadId(id),
  cwd: "/x",
  pid: 1,
  status: "idle",
  updatedAt: 0,
});

const poll = Schedule.spaced("10 millis");
const run = <A, E>(
  self: Effect.Effect<A, E, SessionsStore>,
  catalog: Layer.Layer<ThreadRepository>,
) =>
  Effect.runPromise(
    self.pipe(
      Effect.provide(
        SessionsStoreLive(poll).pipe(
          Layer.provide(
            harnessesOf(
              harness(
                "claude",
                Layer.mergeAll(
                  catalog,
                  RunSourceMemory({}),
                  TaskRepositoryMemory({}),
                ),
              ),
            ),
          ),
        ),
      ),
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
        expect(seen.map((s) => s.id)).toEqual([ThreadId("a"), ThreadId("b")]);
      }),
      ThreadRepositoryMemory(() => current),
    );
  });

  test("a failed poll keeps the last known sessions", () => {
    let calls = 0;
    const flaky = Layer.succeed(ThreadRepository, {
      list: Effect.suspend(() =>
        ++calls === 1
          ? Effect.succeed([session("a")])
          : Effect.fail(new SourceError({ message: "boom" })),
      ),
    });
    return run(
      Effect.gen(function* () {
        const { sessions, unreadable } = yield* SessionsStore;
        const read = SubscriptionRef.get(sessions);
        yield* until(read, (s) => s.length === 1);
        yield* Effect.sleep("60 millis");
        expect(calls).toBeGreaterThan(2);
        expect(yield* read).toHaveLength(1);
        expect(yield* SubscriptionRef.get(unreadable)).toEqual(["claude"]);
      }),
      flaky,
    );
  });
});

describe("SessionsStore across harnesses", () => {
  test("merges every harness, newest first", () => {
    const codex = { ...session("c"), harness: "codex", updatedAt: 9 } as const;
    const of = (s: Thread) =>
      harness(
        s.harness,
        Layer.mergeAll(
          ThreadRepositoryMemory(() => [s]),
          RunSourceMemory({}),
          TaskRepositoryMemory({}),
        ),
      );
    return Effect.runPromise(
      Effect.gen(function* () {
        const { sessions } = yield* SessionsStore;
        const seen = yield* until(
          SubscriptionRef.get(sessions),
          (s) => s.length === 2,
        );
        expect(seen.map((s) => s.harness)).toEqual(["codex", "claude"]);
      }).pipe(
        Effect.provide(
          SessionsStoreLive(poll).pipe(
            Layer.provide(harnessesOf(of(session("a")), of(codex))),
          ),
        ),
        Effect.scoped,
      ),
    );
  });
});
