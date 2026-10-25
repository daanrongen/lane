import type { Ref } from "@/domain/ref.ts";

export type LinkKind =
  | "spawned"
  | "handed-off"
  | "messaged"
  | "forked"
  | "resumed"
  | "shares"
  | "worktree-of"
  | "uses-runtime";

// A typed, time-ranged edge between two things.
export interface Link {
  readonly kind: LinkKind;
  readonly from: Ref;
  readonly to: Ref;
  readonly at: number;
  readonly until?: number;
}
