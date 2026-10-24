import { Effect } from "effect";

// Polls `read` until `ok` holds; stores update on forked fibers.
export const until = <A>(read: Effect.Effect<A>, ok: (a: A) => boolean) =>
  Effect.gen(function* () {
    for (let i = 0; i < 100; i++) {
      const a = yield* read;
      if (ok(a)) return a;
      yield* Effect.sleep("10 millis");
    }
    return yield* Effect.fail(new Error("timed out"));
  });
