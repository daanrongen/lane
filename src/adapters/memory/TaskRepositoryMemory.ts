import { Layer, Stream } from "effect";
import type { Task } from "@/domain/task.ts";
import { TaskRepository } from "@/ports/TaskRepository.ts";

// A fixed list per session id; a session with none has no tasks.
export const TaskRepositoryMemory = (lists: Record<string, readonly Task[]>) =>
  Layer.succeed(TaskRepository, {
    tasks: (session) => Stream.make(lists[session.id] ?? []),
  });
