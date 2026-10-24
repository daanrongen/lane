import {
  Context,
  Effect,
  Layer,
  type Schedule,
  Stream,
  SubscriptionRef,
} from "effect";
import type { Session } from "@/domain/session.ts";
import { Harnesses } from "@/ports/Harness.ts";

export class SessionsStore extends Context.Service<
  SessionsStore,
  { readonly sessions: SubscriptionRef.SubscriptionRef<readonly Session[]> }
>()("SessionsStore") {}

type Listing = Effect.Effect<readonly Session[], unknown>;

// A harness that fails to answer keeps its last known sessions; the others still show.
const lister = () => {
  const last = new Map<Listing, readonly Session[]>();
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
      const sessions = yield* SubscriptionRef.make<readonly Session[]>([]);

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
