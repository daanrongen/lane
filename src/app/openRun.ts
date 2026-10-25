import { Effect, Stream, SubscriptionRef } from "effect";
import { fold } from "@/domain/fold.ts";
import { emptyRun, type Run } from "@/domain/run.ts";
import type { Task } from "@/domain/task.ts";
import type { Thread } from "@/domain/thread.ts";
import { Harnesses } from "@/ports/Harness.ts";
import { SourceError } from "@/ports/SourceError.ts";

export type RunStatus = "reading" | "ended" | "failed";

export interface OpenRun {
  readonly run: SubscriptionRef.SubscriptionRef<Run>;
  readonly status: SubscriptionRef.SubscriptionRef<RunStatus>;
  readonly tasks: SubscriptionRef.SubscriptionRef<readonly Task[]>;
}

// Folds a session's events into a Run, and follows its task lists, until the scope closes.
export const openRun = (session: Thread) =>
  Effect.gen(function* () {
    const harnesses = yield* Harnesses;
    const run = yield* SubscriptionRef.make(emptyRun(session.id, 0));
    const status = yield* SubscriptionRef.make<RunStatus>("reading");
    const tasks = yield* SubscriptionRef.make<readonly Task[]>([]);

    const source = harnesses.find((h) => h.id === session.harness);
    const events = source
      ? source.events(session)
      : Stream.fail(
          new SourceError({ message: `no ${session.harness} harness` }),
        );
    yield* events.pipe(
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

    // A harness without task lists just leaves this empty.
    yield* (source?.tasks(session) ?? Stream.empty).pipe(
      Stream.runForEach((next) => SubscriptionRef.set(tasks, next)),
      Effect.ignore,
      Effect.forkScoped,
    );
    return { run, status, tasks } satisfies OpenRun;
  });
