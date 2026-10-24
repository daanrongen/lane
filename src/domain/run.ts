import type { AgentId, SessionId, SpanId } from "@/domain/ids.ts";

export interface Usage {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
}

export const emptyUsage: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const addUsage = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
});

export interface Agent {
  readonly id: AgentId;
  readonly parentId: AgentId | null;
  readonly name: string;
}

interface SpanBase {
  readonly id: SpanId;
  readonly agentId: AgentId;
  readonly label: string;
  readonly start: number;
  readonly end?: number;
}

export type Span =
  | (SpanBase & { readonly _tag: "Thinking" })
  | (SpanBase & {
      readonly _tag: "ToolCall";
      readonly tool: string;
      readonly failed: boolean;
    })
  | (SpanBase & {
      readonly _tag: "McpCall";
      readonly server: string;
      readonly tool: string;
      readonly failed: boolean;
    })
  | (SpanBase & { readonly _tag: "Waiting"; readonly on: AgentId });

export interface Handoff {
  readonly from: AgentId;
  readonly to: AgentId;
  readonly at: number;
  readonly returnedAt?: number;
}

export interface Finish {
  readonly agentId: AgentId;
  readonly at: number;
}

// One model response; usage is per response, not per span.
export interface Turn {
  readonly agentId: AgentId;
  readonly at: number;
  readonly model?: string;
  readonly usage: Usage;
}

// Something that entered an agent's context; tokens are estimated from its size.
export interface Entry {
  readonly agentId: AgentId;
  readonly at: number;
  readonly kind: "Message" | "File" | "Tool";
  readonly label: string;
  readonly tokens: number;
}

export interface Tool {
  readonly name: string;
  readonly tokens: number;
}

// What an agent was configured with: its system prompt and tool definitions.
export interface Setup {
  readonly agentId: AgentId;
  readonly at: number;
  readonly system: number;
  readonly tools: readonly Tool[];
}

// Times are seconds from startedAt (epoch ms).
export interface Run {
  readonly sessionId: SessionId;
  readonly startedAt: number;
  readonly agents: readonly Agent[];
  readonly spans: readonly Span[];
  readonly handoffs: readonly Handoff[];
  readonly turns: readonly Turn[];
  readonly finishes: readonly Finish[];
  readonly context: readonly Entry[];
  readonly setups: readonly Setup[];
}

export const emptyRun = (sessionId: SessionId, startedAt: number): Run => ({
  sessionId,
  startedAt,
  agents: [],
  spans: [],
  handoffs: [],
  turns: [],
  finishes: [],
  context: [],
  setups: [],
});
