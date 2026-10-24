import { mcpName } from "@/domain/mcp.ts";
import type { Entry, Setup, Usage } from "@/domain/run.ts";

export interface ContextGauge {
  readonly used: number;
  readonly window: number | null;
  readonly ratio: number | null;
}

// Everything the model read on its last turn.
export const contextUsed = (u: Usage) => u.input + u.cacheRead + u.cacheWrite;

export const contextGauge = (
  lastTurn: Usage,
  window: number | null,
): ContextGauge => {
  const used = contextUsed(lastTurn);
  return {
    used,
    window,
    ratio: window ? Math.min(1, used / window) : null,
  };
};

export type CellKind = Entry["kind"] | "System" | "Tools" | "Free";

export interface Cell {
  readonly kind: CellKind;
  readonly label: string;
  readonly tokens: number;
}

export interface ContextMap {
  readonly used: number;
  readonly window: number;
  readonly cells: readonly Cell[];
}

const MAX_CELLS = 10;

// The transcript never names the window; Claude 5 models run with 1M here.
export const windowFor = (model: string | undefined, used: number) =>
  /\[1m\]|claude-.*-5-/.test(model ?? "") || used > 200_000
    ? 1_000_000
    : 200_000;

const grouped = (entries: readonly Entry[]): Cell[] => {
  const sums = new Map<string, Cell>();
  for (const { kind, label, tokens } of entries) {
    const key = `${kind}:${label}`;
    sums.set(key, {
      kind,
      label,
      tokens: (sums.get(key)?.tokens ?? 0) + tokens,
    });
  }
  return [...sums.values()].sort((a, b) => b.tokens - a.tokens);
};

const withRest = (cells: Cell[]): Cell[] => {
  if (cells.length <= MAX_CELLS) return cells;
  const rest = cells.slice(MAX_CELLS);
  return [
    ...cells.slice(0, MAX_CELLS),
    {
      kind: "Tool",
      label: `${rest.length} more`,
      tokens: rest.reduce((n, c) => n + c.tokens, 0),
    },
  ];
};

// Native tools share one cell; each MCP server gets its own.
const definitions = (setup: Setup): Cell[] => {
  const tokens = new Map<string, number>();
  for (const t of setup.tools) {
    const label = mcpName(t.name)
      ? `mcp · ${mcpName(t.name)?.server}`
      : "Tool definitions";
    tokens.set(label, (tokens.get(label) ?? 0) + t.tokens);
  }
  return [
    { kind: "System", label: "System prompt", tokens: setup.system },
    ...[...tokens].map(([label, n]) => ({
      kind: "Tools" as const,
      label,
      tokens: n,
    })),
  ];
};

const sum = (cells: readonly Cell[]) => cells.reduce((n, c) => n + c.tokens, 0);

// Sizes are estimates; the last turn's real total scales them down if they
// overshoot, and whatever they leave over is shown as the remainder.
export const contextMap = (
  entries: readonly Entry[],
  setup: Setup | undefined,
  used: number,
  window: number,
): ContextMap => {
  const known = [
    ...(setup ? definitions(setup) : []),
    ...withRest(grouped(entries)),
  ];
  const estimated = sum(known);
  const total = used || estimated;
  const scale = estimated > total ? total / estimated : 1;
  const rest = total - estimated * scale;
  return {
    used: total,
    window: Math.max(window, total),
    cells: [
      ...known.map((c) => ({ ...c, tokens: c.tokens * scale })),
      ...(rest > 0
        ? [
            {
              kind: "System",
              label: setup ? "Other" : "System & tools",
              tokens: rest,
            } as const,
          ]
        : []),
      { kind: "Free", label: "Free", tokens: Math.max(window, total) - total },
    ],
  };
};
