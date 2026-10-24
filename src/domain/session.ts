import type { SessionId } from "@/domain/ids.ts";

// Who runs the agents; the dashboard is agnostic to which.
export type HarnessId = "claude" | "codex";

// A past session has no running process; its transcript is all that remains.
export type SessionStatus = "busy" | "idle" | "past";

export interface Session {
  readonly harness: HarnessId;
  readonly id: SessionId;
  readonly cwd: string;
  // Only harnesses with a process registry know it.
  readonly pid?: number;
  readonly status: SessionStatus;
  readonly name?: string;
  readonly updatedAt: number;
}
