import type { Cell, CellKind, ContextMap } from "@/domain/context.ts";
import type { AgentId } from "@/domain/ids.ts";
import type { McpServer } from "@/domain/mcp.ts";
import type { HostSummary } from "@/domain/network.ts";
import type { Request, Span } from "@/domain/run.ts";
import type { Lane } from "@/domain/timeline.ts";
import { duration, exact, percent, plural, tokens } from "@/ui/lib/format.ts";

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
