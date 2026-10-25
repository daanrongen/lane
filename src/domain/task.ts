import type { AgentId } from "@/domain/ids.ts";

export type TaskStatus = "next" | "doing" | "done";

// Where a task came from: a list the harness keeps, work handed to an agent, or what is running now.
export type TaskSource = "todo" | "queue" | "goal" | "agent" | "now";

export interface TaskItem {
  readonly title: string;
  readonly status: TaskStatus;
}

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly source: TaskSource;
  readonly owner: AgentId;
  // Seconds into the run when it reached this status.
  readonly since: number;
}

export const taskId = (source: TaskSource, owner: AgentId, title: string) =>
  `${source}:${owner}:${title}`;

// Items of a list as it changes: each keeps the time it reached its current status.
export const stamped = (
  source: TaskSource,
  owner: AgentId,
  at: number,
  items: readonly TaskItem[],
  previous: readonly Task[],
): Task[] =>
  items.map((item) => {
    const id = taskId(source, owner, item.title);
    const before = previous.find((t) => t.id === id);
    return {
      id,
      title: item.title,
      status: item.status,
      source,
      owner,
      since: before?.status === item.status ? before.since : at,
    };
  });
