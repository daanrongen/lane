declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ThreadId = Brand<string, "ThreadId">;
export type AgentId = Brand<string, "AgentId">;
export type SpanId = Brand<string, "SpanId">;

export const ThreadId = (s: string) => s as ThreadId;
export const AgentId = (s: string) => s as AgentId;
export const SpanId = (s: string) => s as SpanId;

export type ActId = Brand<string, "ActId">;
// Unique across the machine: `harness:thread:agent`.
export type AgentRef = Brand<string, "AgentRef">;

export const ActId = (s: string) => s as ActId;
export const AgentRef = (harness: string, thread: string, agent: string) =>
  `${harness}:${thread}:${agent}` as AgentRef;
