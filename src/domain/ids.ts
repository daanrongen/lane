declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type SessionId = Brand<string, "SessionId">;
export type AgentId = Brand<string, "AgentId">;
export type SpanId = Brand<string, "SpanId">;

export const SessionId = (s: string) => s as SessionId;
export const AgentId = (s: string) => s as AgentId;
export const SpanId = (s: string) => s as SpanId;
