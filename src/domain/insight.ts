import type { AgentSummary } from "@/domain/agent.ts";
import { LIMIT_NEAR } from "@/domain/attention.ts";
import type { AgentRef } from "@/domain/ids.ts";
import { file, type Ref } from "@/domain/ref.ts";

export type InsightKind =
  | "loop"
  | "retry-storm"
  | "near-full"
  | "collision"
  | "rate-limited";

export interface Insight {
  readonly kind: InsightKind;
  readonly agents: readonly AgentRef[];
  readonly label: string;
  readonly ref?: Ref;
}

export const NEAR_FULL = 0.9;
// Edits further apart than this are not a collision.
export const COLLISION_WINDOW = 600_000;

// What an agent's own history shows.
export const insightsOf = (s: AgentSummary): readonly InsightKind[] => [
  ...(s.loop ? (["loop"] as const) : []),
  ...(s.retries ? (["retry-storm"] as const) : []),
  ...((s.vitals.fill?.ratio ?? 0) >= NEAR_FULL ? (["near-full"] as const) : []),
  ...(s.vitals.limits.some((l) => l.used >= LIMIT_NEAR) ||
  s.last?.failure?.class === "rate-limit"
    ? (["rate-limited"] as const)
    : []),
];

export interface Edited {
  // The thread's root agent, so a parent and its sub-agents never collide.
  readonly owner: string;
  readonly agent: AgentRef;
  readonly path: string;
  // Epoch ms of the last edit.
  readonly at: number;
}

// Different threads changing one file within the window.
export const collisions = (
  edits: readonly Edited[],
  now: number,
): Insight[] => {
  const byPath = new Map<string, Edited[]>();
  for (const e of edits) {
    if (now - e.at > COLLISION_WINDOW) continue;
    byPath.set(e.path, [...(byPath.get(e.path) ?? []), e]);
  }
  return [...byPath]
    .filter(([, list]) => new Set(list.map((e) => e.owner)).size > 1)
    .map(([path, list]) => ({
      kind: "collision" as const,
      agents: [...new Set(list.map((e) => e.agent))],
      label: path,
      ref: file(path),
    }));
};
