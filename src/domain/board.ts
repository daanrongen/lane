import type { Run } from "@/domain/run.ts";
import { type Task, type TaskStatus, taskId } from "@/domain/task.ts";

export interface Board {
  readonly done: readonly Task[];
  readonly doing: readonly Task[];
  readonly next: readonly Task[];
}

// Work handed to a sub-agent is a task for as long as it runs.
const delegated = (run: Run): Task[] =>
  run.handoffs.map((h) => {
    const agent = run.agents.find((a) => a.id === h.to);
    const wait = run.spans.find((s) => s._tag === "Waiting" && s.on === h.to);
    const finished = run.finishes.findLast((f) => f.agentId === h.to);
    const title = wait?.label ?? agent?.name ?? "agent";
    return {
      id: taskId("agent", h.to, title),
      title,
      status: finished ? "done" : "doing",
      source: "agent",
      owner: h.to,
      since: finished?.at ?? h.at,
    };
  });

// What an agent is in the middle of, while a call is still open.
const running = (run: Run): Task[] =>
  run.spans
    .filter((s) => s.end === undefined && s._tag !== "Waiting")
    .slice(-1)
    .map((s) => {
      const title = s._tag === "Thinking" ? "thinking" : s.label;
      return {
        id: taskId("now", s.agentId, title),
        title,
        status: "doing" as const,
        source: "now" as const,
        owner: s.agentId,
        since: s.start,
      };
    });

// What the agents have done, are doing, and have lined up next: their own task lists plus what the run shows.
export const board = (run: Run, lists: readonly Task[]): Board => {
  // A plan's steps are never ticked off, so an explicit task list replaces them.
  const explicit = new Set(
    lists.filter((t) => t.source === "todo").map((t) => t.owner),
  );
  const kept = lists.filter(
    (t) => t.source !== "plan" || !explicit.has(t.owner),
  );
  const all = [...delegated(run), ...running(run), ...kept];
  const by = (status: TaskStatus) => all.filter((t) => t.status === status);
  return {
    done: by("done").sort((a, b) => b.since - a.since),
    doing: by("doing").sort((a, b) => a.since - b.since),
    next: by("next"),
  };
};
