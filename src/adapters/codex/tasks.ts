import type { Child, Goal } from "@/adapters/codex/state.ts";
import { arr, parseJson, rec, str } from "@/adapters/shared/json.ts";
import type { RunEvent } from "@/domain/events.ts";
import type { AgentId } from "@/domain/ids.ts";
import type { TaskStatus } from "@/domain/run.ts";

const clip = (s: string) => (s.length > 70 ? `${s.slice(0, 69)}…` : s);

export const goalStatus = (raw: string): TaskStatus =>
  /complet|achiev|done/i.test(raw)
    ? "done"
    : /activ|pursu|progress|running/i.test(raw)
      ? "doing"
      : "next";

// A queued item's text, wherever its payload keeps it.
export const payloadTitle = (json: string) => {
  const p = rec(parseJson(json));
  const text =
    str(p?.text) ??
    str(p?.content) ??
    str(p?.message) ??
    arr(p?.content)
      .map((c) => str(rec(c)?.text) ?? "")
      .join(" ");
  return clip((text || json).split("\n")[0] ?? "");
};

// Codex's goals are what it is working towards; its queue is what comes next.
export const taskEvents = (
  agentId: AgentId,
  at: number,
  goals: readonly Goal[],
  queue: readonly string[],
): RunEvent[] => [
  ...(goals.length
    ? [
        {
          _tag: "PlanReported",
          plan: {
            agentId,
            at,
            source: "goal",
            items: goals.map((g) => ({
              title: clip(g.objective),
              status: goalStatus(g.status),
            })),
          },
        } as const,
      ]
    : []),
  ...(queue.length
    ? [
        {
          _tag: "PlanReported",
          plan: {
            agentId,
            at,
            source: "queue",
            items: queue.map((q) => ({
              title: payloadTitle(q),
              status: "next" as const,
            })),
          },
        } as const,
      ]
    : []),
];

export type { Child };
