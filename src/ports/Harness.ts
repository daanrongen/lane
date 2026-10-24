import { Context, Effect, Layer, type Scope, type Stream } from "effect";
import type { RunEvent } from "@/domain/events.ts";
import type { HarnessId, Session } from "@/domain/session.ts";
import type { Task } from "@/domain/task.ts";
import { RunSource } from "@/ports/RunSource.ts";
import { SessionRepository } from "@/ports/SessionRepository.ts";
import type { SourceError } from "@/ports/SourceError.ts";
import { TaskRepository } from "@/ports/TaskRepository.ts";

// One agent harness: which sessions it has, what happened in each, and what is on its task lists.
export interface Harness {
  readonly id: HarnessId;
  readonly sessions: Effect.Effect<readonly Session[], SourceError>;
  readonly events: (session: Session) => Stream.Stream<RunEvent, SourceError>;
  readonly tasks: (
    session: Session,
  ) => Stream.Stream<readonly Task[], SourceError>;
}

export class Harnesses extends Context.Service<Harnesses, readonly Harness[]>()(
  "Harnesses",
) {}

// A harness is whatever layer provides the three repositories for it.
export const harness = <E, R>(
  id: HarnessId,
  adapters: Layer.Layer<SessionRepository | RunSource | TaskRepository, E, R>,
) =>
  Effect.gen(function* () {
    const context = yield* Layer.build(adapters);
    const sessions = Context.get(context, SessionRepository);
    const runs = Context.get(context, RunSource);
    const tasks = Context.get(context, TaskRepository);
    return {
      id,
      sessions: sessions.list,
      events: (s) => runs.events(s.id),
      tasks: (s) => tasks.tasks(s),
    } satisfies Harness;
  });

export const harnessesOf = <E, R>(
  ...all: readonly Effect.Effect<Harness, E, R | Scope.Scope>[]
) => Layer.effect(Harnesses, Effect.all(all));
