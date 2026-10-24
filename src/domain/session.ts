import type { SessionId } from "@/domain/ids.ts";

export type SessionStatus = "busy" | "idle";

export interface Session {
  readonly id: SessionId;
  readonly cwd: string;
  readonly pid: number;
  readonly status: SessionStatus;
  readonly name?: string;
  readonly updatedAt: number;
}
