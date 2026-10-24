import type { SessionId } from "@/domain/ids.ts";

// Who runs the agents; the dashboard is agnostic to which.
export type HarnessId = "claude" | "codex";

export type SessionStatus = "busy" | "idle";

export interface Session {
  readonly harness: HarnessId;
  readonly id: SessionId;
  readonly cwd: string;
  readonly pid: number;
  readonly status: SessionStatus;
  readonly name?: string;
  readonly updatedAt: number;
}
