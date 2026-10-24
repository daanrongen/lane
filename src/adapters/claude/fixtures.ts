import { BunFileSystem } from "@effect/platform-bun";
import { Effect, type FileSystem, type Scope } from "effect";

// Synthetic transcript lines in Claude Code's shape, for tests.
export const origin = Date.parse("2026-01-01T00:00:00Z");
export const iso = (s: number) => new Date(origin + s * 1000).toISOString();

export const USAGE = {
  input_tokens: 1,
  output_tokens: 2,
  cache_read_input_tokens: 3,
  cache_creation_input_tokens: 4,
};

export const assistant = (
  s: number,
  msgId: string,
  content: unknown[],
  stopReason: string | null = null,
) => ({
  type: "assistant",
  timestamp: iso(s),
  uuid: `u${s}`,
  message: {
    id: msgId,
    model: "m",
    content,
    usage: USAGE,
    stop_reason: stopReason,
  },
});

export const result = (s: number, id: string, isError?: boolean) => ({
  type: "user",
  timestamp: iso(s),
  message: {
    content: [{ type: "tool_result", tool_use_id: id, is_error: isError }],
  },
});

export const toolUse = (id: string, name: string, input = {}) => ({
  type: "tool_use",
  id,
  name,
  input,
});

export const jsonl = (lines: readonly unknown[]) =>
  `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;

// Runs a scoped, filesystem-backed test effect (temp dirs are cleaned up).
export const runFs = <A, E>(
  self: Effect.Effect<A, E, FileSystem.FileSystem | Scope.Scope>,
) =>
  Effect.runPromise(
    self.pipe(Effect.scoped, Effect.provide(BunFileSystem.layer)),
  );
