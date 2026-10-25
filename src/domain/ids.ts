declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ThreadId = Brand<string, "ThreadId">;
export type AgentId = Brand<string, "AgentId">;
export type SpanId = Brand<string, "SpanId">;

export const ThreadId = (s: string) => s as ThreadId;
export const AgentId = (s: string) => s as AgentId;
export const SpanId = (s: string) => s as SpanId;
