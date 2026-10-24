import type { AgentId } from "@/domain/ids.ts";
import type { Plan, Run, TaskStatus } from "@/domain/run.ts";

// Where a card came from: a spawned agent, what the root is doing right now, or a task list.
export type CardSource = "agent" | "now" | Plan["source"];

export interface Card {
  readonly title: string;
  readonly status: TaskStatus;
  readonly source: CardSource;
  readonly owner: AgentId;
  // Seconds into the run when it reached this status.
  readonly since: number;
}

export interface Board {
  readonly done: readonly Card[];
  readonly doing: readonly Card[];
  readonly next: readonly Card[];
}

// A task list's items with when each reached its current status, across the snapshots.
const history = (snapshots: readonly Plan[]): Card[] => {
  const seen = new Map<string, { status: TaskStatus; since: number }>();
  for (const snap of snapshots) {
    for (const item of snap.items) {
      const prev = seen.get(item.title);
      if (prev?.status !== item.status) {
        seen.set(item.title, { status: item.status, since: snap.at });
      }
    }
  }
  const latest = snapshots.at(-1);
  return (latest?.items ?? []).map((item) => ({
    title: item.title,
    status: item.status,
    source: latest?.source ?? "todo",
    owner: latest?.agentId as AgentId,
    since: seen.get(item.title)?.since ?? latest?.at ?? 0,
  }));
};

const latestLists = (run: Run): Card[] => {
  const keys = new Set(run.plans.map((p) => `${p.agentId}:${p.source}`));
  const lists = [...keys].map((key) =>
    history(run.plans.filter((p) => `${p.agentId}:${p.source}` === key)),
  );
  // A plan's steps are never ticked off, so an explicit task list replaces them.
  const explicit = new Set(
    lists.filter((l) => l[0]?.source === "todo").map((l) => l[0]?.owner),
  );
  return lists
    .filter((l) => l[0]?.source !== "plan" || !explicit.has(l[0].owner))
    .flat();
};

const agentCards = (run: Run): Card[] =>
  run.handoffs.map((h) => {
    const agent = run.agents.find((a) => a.id === h.to);
    const wait = run.spans.find((s) => s._tag === "Waiting" && s.on === h.to);
    const finished = run.finishes.findLast((f) => f.agentId === h.to);
    return {
      title: wait?.label ?? agent?.name ?? "agent",
      status: finished ? "done" : "doing",
      source: "agent",
      owner: h.to,
      since: finished?.at ?? h.at,
    };
  });

// What the root is in the middle of, while a call is still open.
const nowCards = (run: Run): Card[] =>
  run.spans
    .filter((s) => s.end === undefined && s._tag !== "Waiting")
    .slice(-1)
    .map((s) => ({
      title: s._tag === "Thinking" ? "thinking" : s.label,
      status: "doing" as const,
      source: "now" as const,
      owner: s.agentId,
      since: s.start,
    }));

// What the agents have done, are doing, and have lined up next.
export const board = (run: Run): Board => {
  const all = [...agentCards(run), ...nowCards(run), ...latestLists(run)];
  const by = (status: TaskStatus) => all.filter((c) => c.status === status);
  return {
    done: by("done").sort((a, b) => b.since - a.since),
    doing: by("doing").sort((a, b) => a.since - b.since),
    next: by("next"),
  };
};
