import type { HarnessId } from "@/domain/thread.ts";

// How a fact is known: read directly, computed from facts, guessed, or not knowable here.
export type Fidelity = "observed" | "derived" | "inferred" | "unknown";

export const FACETS = [
  "process",
  "history",
  "subagents",
  "toolcalls",
  "shell",
  "edits",
  "checkpoints",
  "mcp",
  "skills",
  "hooks",
  "rules",
  "approvals",
  "sandbox",
  "plan",
  "tasks",
  "goals",
  "context",
  "usage",
  "cost",
  "limits",
  "instructions",
  "git",
  "messages",
  "runtime",
] as const;

export type Facet = (typeof FACETS)[number];
export type Support = "native" | "partial" | "none";

// What a harness can report; a facet it leaves out is none.
export interface HarnessProfile {
  readonly id: HarnessId;
  readonly name: string;
  readonly facets: Readonly<Partial<Record<Facet, Support>>>;
}

export const support = (p: HarnessProfile, facet: Facet): Support =>
  p.facets[facet] ?? "none";

// n/a in the UI: the harness cannot say, which is not the same as nothing happened.
export const canReport = (p: HarnessProfile | undefined, facet: Facet) =>
  p !== undefined && support(p, facet) !== "none";
