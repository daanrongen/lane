import type { AgentId } from "@/domain/ids.ts";
import {
  type Agent,
  addUsage,
  emptyUsage,
  type Handoff,
  type Run,
  type Span,
  type Turn,
  type Usage,
} from "@/domain/run.ts";

// Overlapping Waiting spans (parallel spawns) merge into one bar.
export interface Bar {
  readonly kind: Span["_tag"];
  readonly spans: readonly Span[];
  readonly start: number;
  readonly end: number;
  readonly open: boolean;
}

export interface Lane {
  readonly agent: Agent;
  readonly depth: number;
  readonly bars: readonly Bar[];
  readonly model?: string;
  readonly lastTurn?: Turn;
  readonly lastActivity: number;
  // Finished after its last activity; an unfinished agent may only be stalled.
  readonly finished: boolean;
}

export interface Timeline {
  readonly lanes: readonly Lane[];
  readonly links: readonly Handoff[];
  readonly duration: number;
  readonly usage: Usage;
}

// Parents first, children after in spawn order.
const orderAgents = (agents: readonly Agent[]) => {
  const out: { agent: Agent; depth: number }[] = [];
  const visit = (parent: AgentId | null, depth: number) => {
    for (const agent of agents) {
      if (agent.parentId !== parent) continue;
      out.push({ agent, depth });
      visit(agent.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
};

const toBar = (span: Span, now: number): Bar => ({
  kind: span._tag,
  spans: [span],
  start: span.start,
  end: span.end ?? now,
  open: span.end === undefined,
});

const joinOverlaps = (bars: readonly Bar[]): Bar[] => {
  const out: Bar[] = [];
  for (const bar of [...bars].sort((a, b) => a.start - b.start)) {
    const last = out.at(-1);
    if (!last || bar.start > last.end) {
      out.push(bar);
    } else {
      out[out.length - 1] = {
        ...last,
        spans: [...last.spans, ...bar.spans],
        end: Math.max(last.end, bar.end),
        open: last.open || bar.open,
      };
    }
  }
  return out;
};

const barsOf = (spans: readonly Span[], now: number): Bar[] => {
  const bars = spans.map((s) => toBar(s, now));
  const waiting = joinOverlaps(bars.filter((b) => b.kind === "Waiting"));
  const rest = bars.filter((b) => b.kind !== "Waiting");
  return [...waiting, ...rest].sort((a, b) => a.start - b.start);
};

// `now` is seconds from run start; open spans grow to it.
export const timeline = (run: Run, now: number): Timeline => {
  const lanes = orderAgents(run.agents).map(({ agent, depth }): Lane => {
    const turns = run.turns.filter((t) => t.agentId === agent.id);
    const lastTurn = turns.at(-1);
    const bars = barsOf(
      run.spans.filter((s) => s.agentId === agent.id),
      now,
    );
    const lastActivity = Math.max(
      0,
      ...bars.map((b) => b.end),
      ...turns.map((t) => t.at),
    );
    const finishedAt = run.finishes.findLast((f) => f.agentId === agent.id)?.at;
    return {
      agent,
      depth,
      bars,
      model: lastTurn?.model,
      lastTurn,
      lastActivity,
      finished: finishedAt !== undefined && finishedAt >= lastActivity,
    };
  });

  // Order-independent: a finish may be recorded before its spawn.
  const links = run.handoffs.map((h) => ({
    ...h,
    returnedAt: run.finishes.findLast((f) => f.agentId === h.to)?.at,
  }));

  const ends = [
    ...lanes.flatMap((l) => l.bars.map((b) => b.end)),
    ...links.map((h) => h.returnedAt ?? h.at),
  ];

  return {
    lanes,
    links,
    duration: Math.max(0, ...ends),
    usage: run.turns.reduce((u, t) => addUsage(u, t.usage), emptyUsage),
  };
};

export const isFailed = (bar: Bar) =>
  bar.spans.some(
    (s) => (s._tag === "ToolCall" || s._tag === "McpCall") && s.failed,
  );
