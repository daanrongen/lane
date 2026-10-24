import { Effect, Stream, SubscriptionRef } from "effect";
import { fold } from "@/domain/fold.ts";
import type { SessionId } from "@/domain/ids.ts";
import { emptyRun, type Run } from "@/domain/run.ts";
import { RunSource } from "@/ports/RunSource.ts";

export type RunStatus = "reading" | "ended" | "failed";

export interface OpenRun {
  readonly run: SubscriptionRef.SubscriptionRef<Run>;
  readonly status: SubscriptionRef.SubscriptionRef<RunStatus>;
}

// Folds a session's events into a Run until the scope closes.
export const openRun = (id: SessionId) =>
  Effect.gen(function* () {
    const source = yield* RunSource;
    const run = yield* SubscriptionRef.make(emptyRun(id, 0));
    const status = yield* SubscriptionRef.make<RunStatus>("reading");

    yield* source.events(id).pipe(
      // One update per batch keeps a long replay from flooding subscribers.
      Stream.groupedWithin(256, "50 millis"),
      Stream.runForEach((batch) =>
        SubscriptionRef.update(run, (r) => batch.reduce(fold, r)),
      ),
      Effect.matchEffect({
        onFailure: () => SubscriptionRef.set(status, "failed"),
        onSuccess: () => SubscriptionRef.set(status, "ended"),
      }),
      Effect.forkScoped,
    );

    return { run, status } satisfies OpenRun;
  });
