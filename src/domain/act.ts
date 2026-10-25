import type { ActId, AgentId } from "@/domain/ids.ts";
import type { Fidelity } from "@/domain/profile.ts";
import type { Ref } from "@/domain/ref.ts";

export type ActKind =
  | "think"
  | "tool"
  | "shell"
  | "read"
  | "edit"
  | "search"
  | "fetch"
  | "mcp"
  | "skill"
  | "spawn"
  | "ask"
  | "plan"
  | "compact"
  | "message";

export type ActStatus =
  | "queued"
  | "awaiting"
  | "running"
  | "ok"
  | "failed"
  | "denied"
  | "cancelled";

export interface Approval {
  readonly by: "rule" | "user" | "classifier" | "policy" | "sandbox";
  // The pattern that decided it, when a rule did.
  readonly rule?: string;
  readonly outcome: "allow" | "deny";
  // Seconds spent waiting for the decision.
  readonly waited?: number;
}

export type FailureClass =
  | "tool"
  | "denied"
  | "rate-limit"
  | "context"
  | "api"
  | "network"
  | "hook"
  | "interrupted";

export interface Failure {
  readonly class: FailureClass;
  // The first line of the error.
  readonly reason: string;
}

export interface Edit {
  readonly op: "create" | "modify" | "delete" | "rename";
  readonly added?: number;
  readonly removed?: number;
}

// Whatever an agent did: one spine for tool calls, edits, requests, skills and spawns.
export interface Act {
  readonly id: ActId;
  readonly agentId: AgentId;
  readonly kind: ActKind;
  readonly label: string;
  readonly tool?: string;
  // Seconds from the run start.
  readonly start: number;
  readonly end?: number;
  readonly status: ActStatus;
  readonly touches: readonly Ref[];
  readonly approval?: Approval;
  readonly failure?: Failure;
  readonly edit?: Edit;
  readonly exit?: number;
  readonly fidelity: Fidelity;
}

const KINDS: Readonly<Record<string, ActKind>> = {
  Read: "read",
  NotebookRead: "read",
  view_image: "read",
  Edit: "edit",
  Write: "edit",
  MultiEdit: "edit",
  NotebookEdit: "edit",
  apply_patch: "edit",
  Bash: "shell",
  BashOutput: "shell",
  KillShell: "shell",
  shell: "shell",
  exec_command: "shell",
  Grep: "search",
  Glob: "search",
  WebSearch: "search",
  web_search: "search",
  ToolSearch: "search",
  WebFetch: "fetch",
  ExitPlanMode: "plan",
  AskUserQuestion: "ask",
  Skill: "skill",
};

export const actKind = (tool: string): ActKind => KINDS[tool] ?? "tool";

// An ask or a plan stops the agent until a person answers.
export const needsPerson = (kind: ActKind) => kind === "ask" || kind === "plan";

export const isOpen = (a: Act) =>
  a.end === undefined &&
  (a.status === "running" || a.status === "awaiting" || a.status === "queued");

export const isFailed = (a: Act) =>
  a.status === "failed" || a.status === "denied";

const CLASSES: readonly [FailureClass, RegExp][] = [
  ["rate-limit", /rate.?limit|\b429\b|too many requests|quota/i],
  ["denied", /permission|denied|not allowed|doesn't want to proceed/i],
  ["interrupted", /interrupt|aborted|cancel/i],
  ["context", /context (window|length)|prompt is too long|token limit/i],
  ["hook", /\bhook\b/i],
  ["network", /ECONN|ENOTFOUND|timed? ?out|network|dns/i],
  ["api", /\bapi\b|overloaded|\b5\d\d\b/i],
];

// Harnesses report errors as text; the class is a guess from it.
export const failureOf = (reason: string | undefined): Failure => ({
  class: CLASSES.find(([, re]) => re.test(reason ?? ""))?.[0] ?? "tool",
  reason: reason ?? "failed",
});
