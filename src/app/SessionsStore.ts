import {
  Context,
  Effect,
  Layer,
  type Schedule,
  Stream,
  SubscriptionRef,
} from "effect";
import type { Thread } from "@/domain/thread.ts";
import { Harnesses } from "@/ports/Harness.ts";

export class SessionsStore extends Context.Service<
  SessionsStore,
  {
    readonly sessions: SubscriptionRef.SubscriptionRef<readonly Thread[]>;
    // Harnesses whose last listing failed.
    readonly unreadable: SubscriptionRef.SubscriptionRef<readonly string[]>;
  }
>()("SessionsStore") {}

type Listing = {
  readonly id: string;
  readonly list: Effect.Effect<readonly Thread[], unknown>;
};

// A harness that fails to answer keeps its last known sessions; the others still show.
export const lister = () => {
  const last = new Map<string, readonly Thread[]>();
  return (listings: readonly Listing[]) =>
    Effect.forEach(
      listings,
      ({ id, list }) =>
        list.pipe(
          Effect.tap((found) => Effect.sync(() => last.set(id, found))),
          Effect.map((threads) => ({ id, threads, failed: false })),
          Effect.orElseSucceed(() => ({
            id,
            threads: last.get(id) ?? [],
            failed: true,
          })),
        ),
      { concurrency: "unbounded" },
    ).pipe(
      Effect.map((all) => ({
        threads: all
          .flatMap((l) => l.threads)
          .sort((a, b) => b.updatedAt - a.updatedAt),
        unreadable: all.filter((l) => l.failed).map((l) => l.id),
      })),
    );
};

export const SessionsStoreLive = (poll: Schedule.Schedule<unknown>) =>
  Layer.effect(
    SessionsStore,
    Effect.gen(function* () {
      const harnesses = yield* Harnesses;
      const listAll = lister();
      const sessions = yield* SubscriptionRef.make<readonly Thread[]>([]);
      const unreadable = yield* SubscriptionRef.make<readonly string[]>([]);

      yield* Stream.fromSchedule(poll).pipe(
        Stream.runForEach(() =>
          listAll(harnesses.map((h) => ({ id: h.id, list: h.sessions }))).pipe(
            Effect.flatMap((next) =>
              SubscriptionRef.set(sessions, next.threads).pipe(
                Effect.andThen(
                  SubscriptionRef.set(unreadable, next.unreadable),
                ),
              ),
            ),
            Effect.ignore,
          ),
        ),
        Effect.forkScoped,
      );

      return { sessions, unreadable };
    }),
  );
