import { Context, Effect, Layer, type Scope, type Stream } from "effect";
import type { RunEvent } from "@/domain/events.ts";
import type { HarnessId, Session } from "@/domain/session.ts";
import { RunSource } from "@/ports/RunSource.ts";
import { SessionCatalog } from "@/ports/SessionCatalog.ts";
import type { SourceError } from "@/ports/SourceError.ts";

// One agent harness: which sessions it has, and what happened in each.
export interface Harness {
  readonly id: HarnessId;
  readonly sessions: Effect.Effect<readonly Session[], SourceError>;
  readonly events: (session: Session) => Stream.Stream<RunEvent, SourceError>;
}

export class Harnesses extends Context.Service<Harnesses, readonly Harness[]>()(
  "Harnesses",
) {}

// A harness is whatever layer provides the two session ports for it.
export const harness = <E, R>(
  id: HarnessId,
  adapters: Layer.Layer<SessionCatalog | RunSource, E, R>,
) =>
  Effect.gen(function* () {
    const context = yield* Layer.build(adapters);
    const catalog = Context.get(context, SessionCatalog);
    const runs = Context.get(context, RunSource);
    return {
      id,
      sessions: catalog.list,
      events: (s) => runs.events(s.id),
    } satisfies Harness;
  });

export const harnessesOf = <E, R>(
  ...all: readonly Effect.Effect<Harness, E, R | Scope.Scope>[]
) => Layer.effect(Harnesses, Effect.all(all));
