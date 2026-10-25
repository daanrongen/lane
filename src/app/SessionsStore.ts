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
  { readonly sessions: SubscriptionRef.SubscriptionRef<readonly Thread[]> }
>()("SessionsStore") {}

type Listing = Effect.Effect<readonly Thread[], unknown>;

// A harness that fails to answer keeps its last known sessions; the others still show.
const lister = () => {
  const last = new Map<Listing, readonly Thread[]>();
  return (listings: readonly Listing[]) =>
    Effect.forEach(
      listings,
      (listing) =>
        listing.pipe(
          Effect.tap((found) => Effect.sync(() => last.set(listing, found))),
          Effect.orElseSucceed(() => last.get(listing) ?? []),
        ),
      { concurrency: "unbounded" },
    ).pipe(
      Effect.map((all) => all.flat().sort((a, b) => b.updatedAt - a.updatedAt)),
    );
};

export const SessionsStoreLive = (poll: Schedule.Schedule<unknown>) =>
  Layer.effect(
    SessionsStore,
    Effect.gen(function* () {
      const harnesses = yield* Harnesses;
      const listAll = lister();
      const sessions = yield* SubscriptionRef.make<readonly Thread[]>([]);

      yield* Stream.fromSchedule(poll).pipe(
        Stream.runForEach(() =>
          listAll(harnesses.map((h) => h.sessions)).pipe(
            Effect.flatMap((next) => SubscriptionRef.set(sessions, next)),
            Effect.ignore,
          ),
        ),
        Effect.forkScoped,
      );

      return { sessions };
    }),
  );
