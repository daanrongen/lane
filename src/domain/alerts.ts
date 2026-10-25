import type { AgentState } from "@/domain/agent.ts";
import type { Floor } from "@/domain/floor.ts";
import type { AgentRef } from "@/domain/ids.ts";

export interface Alert {
  readonly agent: AgentRef;
  readonly title: string;
  readonly body: string;
}

const WORTH: Partial<Record<AgentState, string>> = {
  "needs-you": "needs you",
  stalled: "stalled",
  failed: "failed",
  done: "finished",
};

// Finishing only matters for work that was going on.
const ACTIVE: readonly AgentState[] = ["working", "waiting"];

// Agents that just entered a state worth leaving the window for.
export const alerts = (prev: Floor | undefined, next: Floor): Alert[] => {
  if (!prev) return [];
  const before = new Map(prev.agents.map((a) => [a.ref, a.state]));
  return next.agents.flatMap((a) => {
    const was = before.get(a.ref);
    const phrase = WORTH[a.state];
    if (!phrase || !was || was === a.state || a.depth > 0) return [];
    if (a.state === "done" && !ACTIVE.includes(was)) return [];
    const why = next.attention.find((x) => x.agent === a.ref)?.label;
    return [
      {
        agent: a.ref,
        title: `${a.name} ${phrase}`,
        body: why ?? a.now?.label ?? "",
      },
    ];
  });
};
