import { type Act, isFailed, isOpen } from "@/domain/act.ts";
import type { AgentId } from "@/domain/ids.ts";
import type { Plan } from "@/domain/plan.ts";
import type { Agent, Run } from "@/domain/run.ts";
import type { Task } from "@/domain/task.ts";
import { orderAgents } from "@/domain/timeline.ts";
import { type Vitals, vitals } from "@/domain/vitals.ts";

export type AgentState =
  | "working"
  | "waiting"
  | "needs-you"
  | "stalled"
  | "failed"
  | "idle"
  | "done";

// Seconds of silence before an agent counts as quiet or stuck.
export interface Thresholds {
  readonly working: number;
  readonly stalled: number;
  // An open call may legitimately run long.
  readonly hung: number;
}

export const THRESHOLDS: Thresholds = { working: 5, stalled: 120, hung: 600 };

export interface FileUse {
  readonly path: string;
  readonly reads: number;
  readonly edits: number;
  readonly last: number;
}

// What a run says about one agent; it does not depend on the clock, so it can be cached per run.
export interface AgentSummary {
  readonly agent: Agent;
  readonly depth: number;
  readonly acts: number;
  readonly failed: number;
  readonly open: readonly Act[];
  readonly last?: Act;
  readonly recent: readonly Act[];
  readonly lastEvent: number;
  readonly finished: boolean;
  readonly vitals: Vitals;
  readonly progress: { readonly done: number; readonly total: number };
  readonly plan?: Plan;
  readonly loop: boolean;
  readonly retries: boolean;
  readonly files: readonly FileUse[];
}

const MAX_FILES = 200;
const RECENT = 60;
const REAL = (a: Act) => a.kind !== "think" && a.kind !== "compact";

// The same call over and over.
const looping = (acts: readonly Act[]) => {
  const counts = new Map<string, number>();
  for (const a of acts.filter(REAL).slice(-6)) {
    const key = `${a.tool}:${a.label}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values()) >= 4;
};

const retrying = (acts: readonly Act[]) =>
  acts.filter(REAL).slice(-5).filter(isFailed).length >= 3;

const filesOf = (acts: readonly Act[]): FileUse[] => {
  const byPath = new Map<string, FileUse>();
  for (const a of acts) {
    for (const t of a.touches) {
      if (t._tag !== "File") continue;
      const prev = byPath.get(t.path);
      const edit = a.kind === "edit";
      byPath.set(t.path, {
        path: t.path,
        reads: (prev?.reads ?? 0) + (edit ? 0 : 1),
        edits: (prev?.edits ?? 0) + (edit ? 1 : 0),
        last: Math.max(prev?.last ?? 0, a.end ?? a.start),
      });
    }
  }
  return [...byPath.values()]
    .sort((a, b) => b.last - a.last)
    .slice(0, MAX_FILES);
};

const progressOf = (tasks: readonly Task[], id: AgentId) => {
  const own = tasks.filter(
    (t) => t.owner === id && t.source !== "now" && t.source !== "agent",
  );
  return {
    done: own.filter((t) => t.status === "done").length,
    total: own.length,
  };
};

export const summarise = (
  run: Run,
  tasks: readonly Task[],
): readonly AgentSummary[] =>
  orderAgents(run.agents).map(({ agent, depth }) => {
    const acts = run.acts.filter((a) => a.agentId === agent.id);
    // A hook that blocked one call does not make the agent failed.
    const last = acts
      .filter((a) => a.tool !== "hook")
      .reduce<Act | undefined>(
        (best, a) => (!best || a.start >= best.start ? a : best),
        undefined,
      );
    const turns = run.turns.filter((t) => t.agentId === agent.id);
    const lastEvent = Math.max(
      0,
      ...acts.map((a) => a.end ?? a.start),
      ...turns.map((t) => t.at),
    );
    const finishedAt = run.finishes.findLast((f) => f.agentId === agent.id)?.at;
    return {
      agent,
      depth,
      acts: acts.length,
      failed: acts.filter(isFailed).length,
      open: acts.filter(isOpen),
      last,
      recent: acts.slice(-RECENT),
      lastEvent,
      finished: finishedAt !== undefined && finishedAt >= lastEvent,
      vitals: vitals(run, agent.id),
      progress: progressOf(tasks, agent.id),
      plan: run.plans.findLast(
        (p) => p.agentId === agent.id && p.status === "proposed",
      ),
      loop: looping(acts),
      retries: retrying(acts),
      files: filesOf(acts),
    };
  });

export const awaiting = (s: AgentSummary) =>
  s.open.filter((a) => a.status === "awaiting");

const lastFailed = (s: AgentSummary) =>
  s.last !== undefined && !isOpen(s.last) && isFailed(s.last);

// `now` is seconds from the run start; `live` says a process still backs the thread.
export const stateOf = (
  s: AgentSummary,
  now: number,
  live: boolean,
  t: Thresholds = THRESHOLDS,
): AgentState => {
  if (live && (awaiting(s).length > 0 || s.plan)) return "needs-you";
  if (!live) return lastFailed(s) ? "failed" : "done";
  if (s.acts === 0) return "idle";

  const calls = s.open.filter((a) => a.kind !== "spawn");
  if (calls.length > 0) {
    const oldest = Math.min(...calls.map((a) => a.start));
    return now - oldest >= t.hung ? "stalled" : "working";
  }
  if (s.open.length > 0) return "waiting";
  if (lastFailed(s)) return "failed";
  if (s.finished) return s.agent.parentId ? "done" : "idle";
  return now - s.lastEvent >= t.stalled ? "stalled" : "working";
};
