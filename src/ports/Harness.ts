import { Context, Effect, Layer, type Scope, type Stream } from "effect";
import type { RunEvent } from "@/domain/events.ts";
import type { Task } from "@/domain/task.ts";
import type { HarnessId, Thread } from "@/domain/thread.ts";
import { RunSource } from "@/ports/RunSource.ts";
import type { SourceError } from "@/ports/SourceError.ts";
import { TaskRepository } from "@/ports/TaskRepository.ts";
import { ThreadRepository } from "@/ports/ThreadRepository.ts";

// One agent harness: which sessions it has, what happened in each, and what is on its task lists.
export interface Harness {
  readonly id: HarnessId;
  readonly sessions: Effect.Effect<readonly Thread[], SourceError>;
  readonly events: (session: Thread) => Stream.Stream<RunEvent, SourceError>;
  readonly tasks: (
    session: Thread,
  ) => Stream.Stream<readonly Task[], SourceError>;
}

export class Harnesses extends Context.Service<Harnesses, readonly Harness[]>()(
  "Harnesses",
) {}

// A harness is whatever layer provides the three repositories for it.
export const harness = <E, R>(
  id: HarnessId,
  adapters: Layer.Layer<ThreadRepository | RunSource | TaskRepository, E, R>,
) =>
  Effect.gen(function* () {
    const context = yield* Layer.build(adapters);
    const sessions = Context.get(context, ThreadRepository);
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
