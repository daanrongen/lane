import type { ThreadId } from "@/domain/ids.ts";

// Who runs the agents; the dashboard is agnostic to which.
export type HarnessId = "claude" | "codex" | "ollama" | (string & {});

// A past thread has no running process; its transcript is all that remains.
export type ThreadStatus = "busy" | "idle" | "past";

export interface Thread {
  readonly harness: HarnessId;
  readonly id: ThreadId;
  readonly cwd: string;
  // Only harnesses with a process registry know it.
  readonly pid?: number;
  readonly status: ThreadStatus;
  readonly name?: string;
  readonly updatedAt: number;
}
