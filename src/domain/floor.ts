import { type ActKind, type ActStatus, isFailed } from "@/domain/act.ts";
import {
  type AgentState,
  type AgentSummary,
  stateOf,
  summarise,
} from "@/domain/agent.ts";
import { type Attention, attentionOf } from "@/domain/attention.ts";
import { type AgentId, AgentRef, type ThreadId } from "@/domain/ids.ts";
import {
  collisions,
  type Edited,
  type Insight,
  type InsightKind,
  insightsOf,
} from "@/domain/insight.ts";
import type { Ref } from "@/domain/ref.ts";
import { addUsage, emptyUsage, type Run, type Usage } from "@/domain/run.ts";
import type { Runtime } from "@/domain/runtime.ts";
import type { Task } from "@/domain/task.ts";
import type { HarnessId, Thread } from "@/domain/thread.ts";
import { fileTree, type Touch, type TreeNode } from "@/domain/tree.ts";
import {
  baseName,
  resolvePath,
  type Workspace,
  within,
} from "@/domain/workspace.ts";

// A thread being followed, with its run folded so far.
export interface Entry {
  readonly thread: Thread;
  readonly run: Run;
  readonly tasks: readonly Task[];
  readonly workspace: Workspace;
}

// A harness process with no transcript behind it, such as `ollama run`.
export interface Proc {
  readonly harness: HarnessId;
  readonly pid: number;
  readonly command: string;
  readonly workspace: Workspace;
  readonly startedAt?: number;
}

export interface AgentView {
  readonly ref: AgentRef;
  readonly harness: HarnessId;
  readonly thread: ThreadId | string;
  readonly origin: "thread" | "process";
  readonly workspace: string;
  readonly parent?: AgentRef;
  readonly depth: number;
  readonly name: string;
  readonly state: AgentState;
  readonly now?: {
    readonly label: string;
    readonly kind: ActKind;
    // Epoch ms.
    readonly since: number;
  };
  // Epoch ms of the last thing it did.
  readonly lastEventAt?: number;
  readonly model?: string;
  readonly provider?: string;
  readonly fill?: {
    readonly used: number;
    readonly window: number | null;
    readonly ratio: number | null;
  };
  readonly usage: Usage;
  readonly progress: { readonly done: number; readonly total: number };
  readonly modes: Readonly<Record<string, string>>;
  readonly acts: number;
  readonly failed: number;
  readonly insights: readonly InsightKind[];
  // The latest acts, for the time lane.
  readonly lane: readonly LaneBar[];
  // Epoch ms when a sub-agent was handed its work.
  readonly born?: number;
}

// One stretch of an agent's time; an open one has no end.
export interface LaneBar {
  // Epoch ms.
  readonly start: number;
  readonly end?: number;
  readonly kind: ActKind;
  readonly failed: boolean;
  readonly awaiting: boolean;
}

// One thing an agent did, for the cross-agent log.
export interface FeedItem {
  // Epoch ms.
  readonly at: number;
  readonly agent: AgentRef;
  readonly kind: ActKind;
  readonly label: string;
  readonly status: ActStatus;
  readonly touches: readonly Ref[];
}

export interface AttentionItem extends Attention {
  readonly agent: AgentRef;
}

export interface WorkspaceView {
  readonly root: string;
  readonly branch?: string;
  readonly agents: readonly AgentRef[];
  readonly tree: TreeNode;
}

export interface RuntimeView extends Runtime {
  readonly usedBy: readonly AgentRef[];
}

export interface Floor {
  readonly at: number;
  readonly agents: readonly AgentView[];
  readonly workspaces: readonly WorkspaceView[];
  readonly attention: readonly AttentionItem[];
  // The latest acts of every agent, newest first.
  readonly feed: readonly FeedItem[];
  readonly insights: readonly Insight[];
  readonly runtimes: readonly RuntimeView[];
  // Harnesses that could not be read; their last known agents stay.
  readonly unreadable: readonly string[];
  readonly totals: {
    readonly states: Readonly<Record<AgentState, number>>;
    readonly usage: Usage;
  };
}

const STATES: readonly AgentState[] = [
  "needs-you",
  "failed",
  "stalled",
  "working",
  "waiting",
  "idle",
  "done",
];

// A run only changes when events arrive, so what it says is worked out once.
const cache = new WeakMap<
  Run,
  { tasks: readonly Task[]; out: readonly AgentSummary[] }
>();
const summarised = (run: Run, tasks: readonly Task[]) => {
  const hit = cache.get(run);
  if (hit && hit.tasks === tasks) return hit.out;
  const out = summarise(run, tasks);
  cache.set(run, { tasks, out });
  return out;
};

const handedAt = (run: Run, id: AgentId, epoch: (t: number) => number) => {
  const h = run.handoffs.find((x) => x.to === id);
  return h && epoch(h.at);
};

const FEED = 100;

const nowOf = (s: AgentSummary, epoch: (t: number) => number) => {
  const act = s.open.findLast((a) => a.kind !== "spawn") ?? s.open.at(-1);
  return act
    ? { label: act.label, kind: act.kind, since: epoch(act.start) }
    : undefined;
};

// Every followed thread and process as one picture of the machine at `at` (epoch ms).
export const floor = (
  at: number,
  entries: readonly Entry[],
  procs: readonly Proc[] = [],
  runtimes: readonly Runtime[] = [],
): Floor => {
  const views: AgentView[] = [];
  const attention: AttentionItem[] = [];
  const feed: FeedItem[] = [];
  const edits: Edited[] = [];
  const touched = new Map<string, Touch[]>();
  const spaces = new Map<string, Workspace>();

  for (const { thread, run, tasks, workspace } of entries) {
    const live = thread.status !== "past";
    const epoch = (t: number) => run.startedAt + t * 1000;
    const now = (at - run.startedAt) / 1000;
    spaces.set(workspace.root, workspace);

    for (const s of summarised(run, tasks)) {
      const ref = AgentRef(thread.harness, thread.id, s.agent.id);
      const state = stateOf(s, now, live);
      for (const a of attentionOf(s, state)) {
        attention.push({ ...a, agent: ref, since: epoch(a.since) });
      }
      for (const f of s.files) {
        const path = resolvePath(thread.cwd, f.path);
        if (!within(workspace.root, path)) continue;
        const touch = {
          agent: ref,
          path,
          reads: f.reads,
          edits: f.edits,
          last: epoch(f.last),
        };
        touched.set(workspace.root, [
          ...(touched.get(workspace.root) ?? []),
          touch,
        ]);
        if (f.edits > 0) {
          edits.push({
            owner: `${thread.harness}:${thread.id}`,
            agent: ref,
            path,
            at: touch.last,
          });
        }
      }
      for (const a of s.recent) {
        if (a.kind === "think") continue;
        feed.push({
          at: epoch(a.start),
          agent: ref,
          kind: a.kind,
          label: a.label,
          status: a.status,
          touches: a.touches,
        });
      }
      views.push({
        ref,
        harness: thread.harness,
        thread: thread.id,
        origin: "thread",
        workspace: workspace.root,
        parent: s.agent.parentId
          ? AgentRef(thread.harness, thread.id, s.agent.parentId)
          : undefined,
        depth: s.depth,
        name: s.agent.parentId ? s.agent.name : (thread.name ?? s.agent.name),
        state,
        now: nowOf(s, epoch),
        lastEventAt: s.acts || s.lastEvent ? epoch(s.lastEvent) : undefined,
        model: s.vitals.model,
        provider: s.vitals.provider,
        fill: s.vitals.fill,
        usage: s.vitals.usage,
        progress: s.progress,
        modes: s.vitals.modes,
        acts: s.acts,
        failed: s.failed,
        insights: insightsOf(s),
        lane: s.recent.map(
          (a): LaneBar => ({
            start: epoch(a.start),
            end: a.end === undefined ? undefined : epoch(a.end),
            kind: a.kind,
            failed: isFailed(a),
            awaiting: a.status === "awaiting",
          }),
        ),
        born: handedAt(run, s.agent.id, epoch),
      });
    }
  }

  for (const p of procs) {
    spaces.set(p.workspace.root, p.workspace);
    views.push({
      ref: AgentRef(p.harness, `pid-${p.pid}`, "main"),
      harness: p.harness,
      thread: `pid-${p.pid}`,
      origin: "process",
      workspace: p.workspace.root,
      depth: 0,
      name: baseName(p.command.split(/\s+/)[0] ?? p.command),
      state: "idle",
      lastEventAt: p.startedAt,
      usage: emptyUsage,
      progress: { done: 0, total: 0 },
      modes: {},
      acts: 0,
      failed: 0,
      insights: [],
      lane: [],
    });
  }

  const found = collisions(edits, at);
  const clashing = new Set(found.flatMap((i) => i.agents));
  const agents = views.map((v) =>
    clashing.has(v.ref)
      ? { ...v, insights: [...v.insights, "collision" as const] }
      : v,
  );
  const clashed = new Set(
    found.flatMap((i) => (i.ref?._tag === "File" ? [i.ref.path] : [])),
  );

  const workspaces = [...spaces.values()]
    .map(
      (w): WorkspaceView => ({
        root: w.root,
        branch: w.branch,
        agents: agents.filter((a) => a.workspace === w.root).map((a) => a.ref),
        tree: fileTree(w.root, touched.get(w.root) ?? [], clashed),
      }),
    )
    .sort(
      (a, b) =>
        latest(agents, b.root) - latest(agents, a.root) ||
        a.root.localeCompare(b.root),
    );

  const hits = agents.map((a) => a.provider);
  return {
    at,
    agents,
    workspaces,
    attention,
    feed: feed.sort((a, b) => b.at - a.at).slice(0, FEED),
    insights: [
      ...found,
      ...agents.flatMap((a) =>
        a.insights
          .filter((k) => k !== "collision")
          .map((kind) => ({ kind, agents: [a.ref], label: a.name })),
      ),
    ],
    runtimes: runtimes.map((r) => ({
      ...r,
      usedBy: agents.filter((_, i) => hits[i] === r.kind).map((a) => a.ref),
    })),
    unreadable: [],
    totals: {
      states: Object.fromEntries(
        STATES.map((s) => [s, agents.filter((a) => a.state === s).length]),
      ) as Record<AgentState, number>,
      usage: agents.reduce((u, a) => addUsage(u, a.usage), emptyUsage),
    },
  };
};

const latest = (agents: readonly AgentView[], root: string) =>
  Math.max(
    0,
    ...agents
      .filter((a) => a.workspace === root)
      .map((a) => a.lastEventAt ?? 0),
  );
