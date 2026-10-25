import type { AgentState, AgentSummary } from "@/domain/agent.ts";
import { awaiting } from "@/domain/agent.ts";

export type Reason =
  | "approval"
  | "question"
  | "plan"
  | "rate-limit"
  | "failed"
  | "stalled";

export interface Attention {
  readonly reason: Reason;
  readonly label: string;
  // Seconds from the run start when it began.
  readonly since: number;
}

export const LIMIT_NEAR = 0.9;

const limited = (s: AgentSummary) =>
  s.vitals.limits.find((l) => l.used >= LIMIT_NEAR);

// What stands between an agent and carrying on, most urgent first.
export const attentionOf = (
  s: AgentSummary,
  state: AgentState,
): readonly Attention[] => {
  const out: Attention[] = awaiting(s).map((a) => ({
    reason:
      a.kind === "ask" ? "question" : a.kind === "plan" ? "plan" : "approval",
    label: a.label,
    since: a.start,
  }));
  if (s.plan && !out.some((a) => a.reason === "plan")) {
    out.push({ reason: "plan", label: s.plan.title, since: s.plan.at });
  }
  const limit = limited(s);
  const throttled = s.last?.failure?.class === "rate-limit";
  if (limit || throttled) {
    out.push({
      reason: "rate-limit",
      label: limit
        ? `${limit.window} ${Math.round(limit.used * 100)}%`
        : "rate limited",
      since: s.lastEvent,
    });
  }
  if (state === "failed") {
    out.push({
      reason: "failed",
      label: s.last?.failure?.reason ?? s.last?.label ?? "failed",
      since: s.last?.end ?? s.lastEvent,
    });
  }
  if (state === "stalled") {
    out.push({ reason: "stalled", label: "silent", since: s.lastEvent });
  }
  return out;
};
