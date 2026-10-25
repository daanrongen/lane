import type { Run, Span } from "@/domain/run.ts";

const upTo = <T extends { readonly at: number }>(
  items: readonly T[],
  t: number,
) => items.filter((i) => i.at <= t);

const clip = (span: Span, t: number): Span =>
  span.end !== undefined && span.end > t ? { ...span, end: undefined } : span;

// The seconds into the run of its last event.
export const lastAt = (run: Run) =>
  Math.max(
    0,
    ...run.spans.map((s) => s.end ?? s.start),
    ...[...run.turns, ...run.finishes, ...run.requests].map((e) => e.at),
  );

// The run as it stood `t` seconds in: later events are gone and spans still going are open.
export const runAt = (run: Run, t: number): Run => {
  const spans = run.spans.filter((s) => s.start <= t).map((s) => clip(s, t));
  const seen = new Set([
    ...spans.map((s) => s.agentId),
    ...upTo(run.turns, t).map((e) => e.agentId),
  ]);
  return {
    ...run,
    agents: run.agents.filter((a) => a.parentId === null || seen.has(a.id)),
    spans,
    handoffs: run.handoffs.filter((h) => h.at <= t),
    turns: upTo(run.turns, t),
    finishes: upTo(run.finishes, t),
    context: upTo(run.context, t),
    setups: upTo(run.setups, t),
    requests: upTo(run.requests, t),
    skills: upTo(run.skills, t),
    modes: upTo(run.modes, t),
    readings: upTo(run.readings, t),
    acts: run.acts.filter((a) => a.start <= t),
    plans: upTo(run.plans, t),
    links: run.links.filter((l) => l.at <= t),
  };
};
