import type { AgentId } from "@/domain/ids.ts";
import type { Usage } from "@/domain/run.ts";

// A value that changes over time for one agent.
export type Signal =
  | {
      readonly _tag: "Mode";
      readonly kind:
        | "permission"
        | "approval"
        | "sandbox"
        | "plan"
        | "effort"
        | "collaboration";
      readonly value: string;
    }
  | {
      readonly _tag: "Model";
      readonly id: string;
      readonly provider?: string;
    }
  | { readonly _tag: "Fill"; readonly used: number; readonly window?: number }
  | ({ readonly _tag: "Usage" } & Usage)
  | {
      readonly _tag: "Limit";
      // A quota window: "5h", "weekly".
      readonly window: string;
      // 0 to 1.
      readonly used: number;
      readonly resetsAt?: number;
    };

export interface Reading {
  readonly agentId: AgentId;
  readonly at: number;
  readonly signal: Signal;
}
