import {
  Context,
  Effect,
  Layer,
  type Schedule,
  Stream,
  SubscriptionRef,
} from "effect";
import type { Session } from "@/domain/session.ts";
import { SessionCatalog } from "@/ports/SessionCatalog.ts";

export class SessionsStore extends Context.Service<
  SessionsStore,
  { readonly sessions: SubscriptionRef.SubscriptionRef<readonly Session[]> }
>()("SessionsStore") {}

// A failed poll keeps the last known sessions.
export const SessionsStoreLive = (poll: Schedule.Schedule<unknown>) =>
  Layer.effect(
    SessionsStore,
    Effect.gen(function* () {
      const catalog = yield* SessionCatalog;
      const sessions = yield* SubscriptionRef.make<readonly Session[]>([]);

      yield* Stream.fromSchedule(poll).pipe(
        Stream.runForEach(() =>
          catalog.list.pipe(
            Effect.flatMap((next) => SubscriptionRef.set(sessions, next)),
            Effect.ignore,
          ),
        ),
        Effect.forkScoped,
      );

      return { sessions };
    }),
  );
