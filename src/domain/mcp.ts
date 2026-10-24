import type { Setup, Span } from "@/domain/run.ts";

// MCP tools are named `mcp__<server>__<tool>`.
export const mcpName = (name: string) => {
  const m = /^mcp__(.+?)__(.+)$/.exec(name);
  return m?.[1] && m[2] ? { server: m[1], tool: m[2] } : undefined;
};

export interface McpServer {
  readonly name: string;
  readonly tools: number;
  readonly tokens: number;
  readonly calls: number;
  readonly failed: number;
}

const blank = (name: string): McpServer => ({
  name,
  tools: 0,
  tokens: 0,
  calls: 0,
  failed: 0,
});

// Servers that contributed tools to an agent's setup or were called in the run.
export const mcpServers = (
  setups: readonly Setup[],
  spans: readonly Span[],
): McpServer[] => {
  const servers = new Map<string, McpServer>();
  const bump = (name: string, f: (s: McpServer) => McpServer) =>
    servers.set(name, f(servers.get(name) ?? blank(name)));

  const latest = new Map(setups.map((s) => [s.agentId, s]));
  for (const { tools } of latest.values()) {
    for (const t of tools) {
      const mcp = mcpName(t.name);
      if (mcp) {
        bump(mcp.server, (s) => ({
          ...s,
          tools: s.tools + 1,
          tokens: s.tokens + t.tokens,
        }));
      }
    }
  }
  for (const span of spans) {
    if (span._tag !== "McpCall") continue;
    bump(span.server, (s) => ({
      ...s,
      calls: s.calls + 1,
      failed: s.failed + (span.failed ? 1 : 0),
    }));
  }
  return [...servers.values()].sort(
    (a, b) => b.calls - a.calls || a.name.localeCompare(b.name),
  );
};
