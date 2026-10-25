import type { Act, ActStatus, Approval, Edit, Failure } from "@/domain/act.ts";
import type { ActId, AgentId, SpanId } from "@/domain/ids.ts";
import type { Link } from "@/domain/link.ts";
import type { Plan, PlanStatus } from "@/domain/plan.ts";
import type { Ref } from "@/domain/ref.ts";
import type {
  Agent,
  Entry,
  ModeChange,
  Request,
  Setup,
  SkillUse,
  Span,
  Turn,
} from "@/domain/run.ts";
import type { Reading } from "@/domain/signal.ts";

export type RunEvent =
  | { readonly _tag: "RunStarted"; readonly startedAt: number }
  | {
      readonly _tag: "AgentSpawned";
      readonly agent: Agent;
      readonly at: number;
    }
  | {
      readonly _tag: "AgentFinished";
      readonly agentId: AgentId;
      readonly at: number;
    }
  | { readonly _tag: "SpanOpened"; readonly span: Span }
  | {
      readonly _tag: "SpanClosed";
      readonly spanId: SpanId;
      readonly at: number;
      readonly failed?: boolean;
      readonly reason?: string;
    }
  | { readonly _tag: "TurnReported"; readonly turn: Turn }
  | { readonly _tag: "ContextAdded"; readonly entry: Entry }
  | {
      readonly _tag: "ContextCompacted";
      readonly agentId: AgentId;
      readonly at: number;
    }
  | { readonly _tag: "SetupReported"; readonly setup: Setup }
  | { readonly _tag: "RequestMade"; readonly request: Request }
  | { readonly _tag: "SkillUsed"; readonly use: SkillUse }
  | { readonly _tag: "ModeChanged"; readonly change: ModeChange }
  // Spans already open an act; these carry what a span cannot say.
  | { readonly _tag: "ActOpened"; readonly act: Act }
  | {
      readonly _tag: "ActUpdated";
      readonly id: ActId;
      readonly end?: number;
      readonly status?: ActStatus;
      readonly failure?: Failure;
      readonly edit?: Edit;
      readonly approval?: Approval;
      readonly exit?: number;
      // Added to what the act already touched.
      readonly touched?: readonly Ref[];
    }
  | { readonly _tag: "SignalReported"; readonly reading: Reading }
  | { readonly _tag: "LinkMade"; readonly link: Link }
  | { readonly _tag: "PlanProposed"; readonly plan: Plan }
  | {
      readonly _tag: "PlanDecided";
      readonly id: string;
      readonly status: PlanStatus;
    };
