import {
  type ContextGauge,
  contextGauge,
  contextUsed,
  windowFor,
} from "@/domain/context.ts";
import type { AgentId } from "@/domain/ids.ts";
import { providerOf } from "@/domain/models.ts";
import { addUsage, emptyUsage, type Run, type Usage } from "@/domain/run.ts";
import type { Signal } from "@/domain/signal.ts";

export type Limit = Extract<Signal, { _tag: "Limit" }>;

// An agent's signals as they stand now.
export interface Vitals {
  readonly model?: string;
  readonly provider?: string;
  readonly fill?: ContextGauge;
  readonly usage: Usage;
  readonly modes: Readonly<Record<string, string>>;
  readonly limits: readonly Limit[];
}

export const vitals = (run: Run, agentId: AgentId): Vitals => {
  const turns = run.turns.filter((t) => t.agentId === agentId);
  const named = turns.findLast((t) => t.model);
  const sized = turns.findLast((t) => contextUsed(t.usage) > 0);
  const readings = run.readings.filter((r) => r.agentId === agentId);

  const modes: Record<string, string> = {};
  const changes = [
    ...run.modes.filter((m) => m.agentId === agentId),
    ...readings.flatMap((r) =>
      r.signal._tag === "Mode"
        ? [{ at: r.at, kind: r.signal.kind, value: r.signal.value }]
        : [],
    ),
  ].sort((a, b) => a.at - b.at);
  for (const c of changes) modes[c.kind] = c.value;

  const limits = new Map<string, Limit>();
  for (const r of readings) {
    if (r.signal._tag === "Limit") limits.set(r.signal.window, r.signal);
  }

  return {
    model: named?.model,
    provider: named?.provider ?? providerOf(named?.model),
    fill: sized
      ? contextGauge(
          sized.usage,
          sized.window ?? windowFor(named?.model, contextUsed(sized.usage)),
        )
      : undefined,
    usage: turns.reduce((u, t) => addUsage(u, t.usage), emptyUsage),
    modes,
    limits: [...limits.values()],
  };
};
