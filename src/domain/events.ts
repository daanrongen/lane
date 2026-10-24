import type { AgentId, SpanId } from "@/domain/ids.ts";
import type { Agent, Entry, Request, Setup, Span, Turn } from "@/domain/run.ts";

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
    }
  | { readonly _tag: "TurnReported"; readonly turn: Turn }
  | { readonly _tag: "ContextAdded"; readonly entry: Entry }
  | {
      readonly _tag: "ContextCompacted";
      readonly agentId: AgentId;
      readonly at: number;
    }
  | { readonly _tag: "SetupReported"; readonly setup: Setup }
  | { readonly _tag: "RequestMade"; readonly request: Request };
