import { describe, expect, test } from "bun:test";
import { AgentId, SpanId } from "@/domain/ids.ts";
import { mcpName, mcpServers } from "@/domain/mcp.ts";
import type { Setup, Span } from "@/domain/run.ts";

const a = AgentId("a");
const call = (server: string, failed = false): Span => ({
  _tag: "McpCall",
  id: SpanId(`${server}${failed}`),
  agentId: a,
  label: "x",
  server,
  tool: "t",
  failed,
  start: 0,
});
const setup: Setup = {
  agentId: a,
  at: 0,
  system: 10,
  tools: [
    { name: "Bash", tokens: 5 },
    { name: "mcp__linear__list_issues", tokens: 7 },
    { name: "mcp__linear__get_issue", tokens: 3 },
  ],
};

describe("mcp", () => {
  test("names split into server and tool", () => {
    expect(mcpName("mcp__plugin_qmd_qmd__query")).toEqual({
      server: "plugin_qmd_qmd",
      tool: "query",
    });
    expect(mcpName("Bash")).toBeUndefined();
  });

  test("servers come from the setup and from calls", () => {
    const servers = mcpServers([setup], [call("github"), call("github", true)]);
    expect(servers).toEqual([
      { name: "github", tools: 0, tokens: 0, calls: 2, failed: 1 },
      { name: "linear", tools: 2, tokens: 10, calls: 0, failed: 0 },
    ]);
  });
});
