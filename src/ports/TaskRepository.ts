import { Context, type Stream } from "effect";
import type { Task } from "@/domain/task.ts";
import type { Thread } from "@/domain/thread.ts";
import type { SourceError } from "@/ports/SourceError.ts";

// The task lists a harness keeps for a session. Each emission is the whole current list.
export class TaskRepository extends Context.Service<
  TaskRepository,
  {
    readonly tasks: (
      session: Thread,
    ) => Stream.Stream<readonly Task[], SourceError>;
  }
>()("TaskRepository") {}
