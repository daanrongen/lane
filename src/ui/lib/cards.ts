import type { Cell, CellKind, ContextMap } from "@/domain/context.ts";
import type { AgentId } from "@/domain/ids.ts";
import type { McpServer } from "@/domain/mcp.ts";
import type { ModelSpan, ModelUse } from "@/domain/models.ts";
import type { HostSummary } from "@/domain/network.ts";
import type { PostureSpan } from "@/domain/posture.ts";
import { type PermissionRule, ruleFor } from "@/domain/rules.ts";
import type { Request, SkillUse, Span } from "@/domain/run.ts";
import type { SkillSummary } from "@/domain/skills.ts";
import type { Task } from "@/domain/task.ts";
import type { Lane } from "@/domain/timeline.ts";
import {
  clip,
  duration,
  exact,
  percent,
  plural,
  tokens,
} from "@/ui/lib/format.ts";

export type Fact = readonly [label: string, value: string];

// What a hover shows: a headline, a few facts, an optional share and a ranked list.
export interface Card {
  readonly title: string;
  readonly subtitle: string;
  readonly facts: readonly Fact[];
  readonly ratio?: number;
  readonly list: readonly Fact[];
}

const failed = (s: Span) =>
  (s._tag === "ToolCall" || s._tag === "McpCall") && s.failed;

const nameOf = (s: Span) => {
  switch (s._tag) {
    case "Thinking":
      return "thinking";
    case "ToolCall":
      return s.tool;
    case "McpCall":
      return `${s.server} · ${s.tool}`;
    case "Waiting":
      return "waiting";
  }
};

const detailOf = (s: Span, names: ReadonlyMap<AgentId, string>) => {
  switch (s._tag) {
    case "Thinking":
      return "reasoning";
    case "ToolCall":
      return s.label === s.tool ? "tool call" : s.label;
    case "McpCall":
      return `mcp call · ${s.label}`;
    case "Waiting":
      return `on ${names.get(s.on) ?? "an agent"}`;
  }
};

const counted = (items: readonly string[]): Fact[] => {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, n]) => [name, `×${n}`]);
};

// One span, or the many a narrow box stands for.
export const spanCard = (
  spans: readonly Span[],
  names: ReadonlyMap<AgentId, string>,
  rules: readonly PermissionRule[] = [],
): Card => {
  const start = Math.min(...spans.map((s) => s.start));
  const open = spans.some((s) => s.end === undefined);
  const end = Math.max(...spans.map((s) => s.end ?? s.start));
  const bad = spans.filter(failed).length;
  const one = spans.length === 1 ? spans[0] : undefined;
  const facts: Fact[] = [
    ["at", duration(start)],
    ["took", open ? "running" : exact(end - start)],
    ...(bad ? [["failed", String(bad)] as const] : []),
    ...(one ? configFacts(one, rules) : []),
  ];
  return one
    ? {
        title: nameOf(one),
        subtitle: detailOf(one, names),
        facts,
        list: [],
      }
    : {
        title: plural(spans.length, "span"),
        subtitle: "too narrow to tell apart",
        facts,
        list: counted(spans.map(nameOf)),
      };
};

const DENIED = /doesn't want to proceed|was denied|not allowed|permission/i;

// Why a call failed, and which permission rule covers it.
const configFacts = (s: Span, rules: readonly PermissionRule[]): Fact[] => {
  if (s._tag !== "ToolCall" && s._tag !== "McpCall") return [];
  const tool = s._tag === "ToolCall" ? s.tool : `mcp__${s.server}__${s.tool}`;
  const rule = ruleFor(rules, tool, s.label);
  return [
    ...(s.reason
      ? [
          [
            DENIED.test(s.reason) ? "blocked" : "error",
            clip(s.reason, 34),
          ] as Fact,
        ]
      : []),
    ...(rule
      ? [["rule", `${rule.effect} ${clip(rule.pattern, 24)}`] as Fact]
      : []),
  ];
};

const KINDS: Record<CellKind, string> = {
  System: "instructions",
  Tools: "definitions",
  Message: "conversation",
  File: "files read",
  Tool: "tool results",
  Free: "free space",
};

export const tileCard = (cell: Cell, map: ContextMap): Card => ({
  title: cell.label,
  subtitle: KINDS[cell.kind],
  facts: [
    ["tokens", tokens(Math.round(cell.tokens))],
    ...(cell.kind === "Free"
      ? []
      : [["of used", percent(cell.tokens, map.used)] as const]),
    ["of window", percent(cell.tokens, map.window)],
    ...(cell.count > 1 ? [["items", String(cell.count)] as const] : []),
  ],
  ratio: cell.tokens / map.window,
  list: cell.parts.map((p) => [p.name, tokens(p.tokens)]),
});

export const serverCard = (server: McpServer): Card => ({
  title: server.name,
  subtitle: "mcp server",
  facts: [
    ["tools", String(server.tools)],
    ["definitions", `${tokens(server.tokens)} tokens`],
    ["calls", String(server.calls)],
    ...(server.failed ? [["failed", String(server.failed)] as const] : []),
  ],
  list: [],
});

export const laneCard = (lane: Lane, used: number, window: number): Card => {
  const spans = lane.bars.flatMap((b) => b.spans);
  const first = Math.min(...spans.map((s) => s.start), lane.lastActivity);
  return {
    title: lane.agent.name,
    subtitle: lane.model ?? "no model yet",
    facts: [
      ["status", lane.finished ? "finished" : "working"],
      ["active", duration(lane.lastActivity - first)],
      ["context", `${tokens(used)} · ${percent(used, window)}`],
      ["spans", String(spans.length)],
    ],
    ratio: window ? used / window : undefined,
    list: counted(spans.filter((s) => s._tag !== "Thinking").map(nameOf)),
  };
};

// One request, or the several a mark stands for.
export const requestsCard = (requests: readonly Request[]): Card => {
  const [first] = requests;
  const hosts = counted(requests.map((r) => r.host));
  return requests.length === 1 && first
    ? {
        title: first.host,
        subtitle: `via ${first.via}`,
        facts: [["at", duration(first.at)]],
        list: first.label ? [["request", first.label.slice(0, 60)]] : [],
      }
    : {
        title: plural(requests.length, "request"),
        subtitle: "outside the machine",
        facts: [["at", duration(Math.min(...requests.map((r) => r.at)))]],
        list: hosts,
      };
};

export const hostCard = (h: HostSummary): Card => ({
  title: h.host,
  subtitle: "external host",
  facts: [
    ["requests", String(h.count)],
    ["first", duration(h.first)],
    ["last", duration(h.last)],
  ],
  list: h.via.map((v): Fact => ["via", v]),
});

const SOURCES: Record<Task["source"], string> = {
  agent: "spawned agent",
  now: "in progress right now",
  todo: "task list",
  plan: "approved plan",
  queue: "queued prompt",
  goal: "goal",
};

export const taskCard = (task: Task, owner: string): Card => ({
  title: task.title,
  subtitle: SOURCES[task.source],
  facts: [
    ["status", task.status],
    ["owner", owner],
    ["since", duration(task.since)],
  ],
  list: [],
});

export const modelSpanCard = (span: ModelSpan, lane: string): Card => ({
  title: span.model,
  subtitle: `${span.provider ?? "unknown provider"} · ${lane}`,
  facts: [
    ["from", duration(span.start)],
    ["until", duration(span.end)],
    ["turns", String(span.turns)],
    ["output", `${tokens(span.output)} tokens`],
  ],
  list: [],
});

export const modelUseCard = (use: ModelUse): Card => ({
  title: use.model,
  subtitle: use.provider ?? "unknown provider",
  facts: [
    ["turns", String(use.turns)],
    ["output", `${tokens(use.output)} tokens`],
    ["first", duration(use.first)],
    ["last", duration(use.last)],
  ],
  list: [],
});

export const postureCard = (span: PostureSpan): Card => ({
  title: span.value,
  subtitle: `${span.kind} mode`,
  facts: [
    ["from", duration(span.start)],
    ["until", duration(span.end)],
    ...span.alongside.map(([k, v]): Fact => [k, v]),
  ],
  list: [],
});

// A skill's description comes from the catalog when it has one.
export const skillCard = (s: SkillSummary, about?: string): Card => ({
  title: s.name,
  subtitle: about ? clip(about, 60) : "skill",
  facts: [
    ["used", plural(s.count, "time")],
    ["first", duration(s.first)],
    ["last", duration(s.last)],
    ["via", s.via.join(", ")],
  ],
  list: [],
});

export const skillMarkCard = (
  uses: readonly SkillUse[],
  about?: string,
): Card => {
  const [first] = uses;
  return uses.length === 1 && first
    ? {
        title: first.name,
        subtitle: about ? clip(about, 60) : `skill, by ${first.via}`,
        facts: [["at", duration(first.at)]],
        list: [],
      }
    : {
        title: plural(uses.length, "skill use"),
        subtitle: "close together",
        facts: [["at", duration(Math.min(...uses.map((u) => u.at)))]],
        list: counted(uses.map((u) => u.name)),
      };
};
