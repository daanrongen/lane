import type { AgentId } from "@/domain/ids.ts";

export type PlanStatus = "proposed" | "approved" | "rejected";

// What an agent intends to do, put to a person for review.
export interface Plan {
  readonly id: string;
  readonly agentId: AgentId;
  readonly at: number;
  readonly title: string;
  readonly steps: readonly string[];
  readonly status: PlanStatus;
}
