import { describe, expect, test } from "bun:test";
import { makeCodexDecoder } from "@/adapters/codex/decode.ts";
import {
  call,
  finished,
  meta,
  model,
  origin,
  output,
  said,
  started,
  tokens,
} from "@/adapters/codex/fixtures.ts";
import type { RunEvent } from "@/domain/events.ts";
import { foldAll } from "@/domain/fold.ts";
import { AgentId, SessionId } from "@/domain/ids.ts";
import { emptyRun } from "@/domain/run.ts";

const main = AgentId("main");
const decode = (lines: unknown[]) => {
  const d = makeCodexDecoder({ origin, agentId: main });
  const events: RunEvent[] = [...lines.flatMap((l) => d.push(l)), ...d.end()];
  return { events, run: foldAll(emptyRun(SessionId("s"), origin), events) };
};

describe("makeCodexDecoder", () => {
  test("the first line announces the agent; the system prompt is sized", () => {
    const { events, run } = decode([meta(0)]);
    expect(events[0]).toMatchObject({
      _tag: "AgentSpawned",
      agent: { name: "codex" },
    });
    expect(run.setups[0]?.system).toBe(10);
  });

  test("a shell call opens and closes; a non-zero exit marks it failed", () => {
    const { run } = decode([
      started(0),
      call(1, "c1", "shell", { command: ["ls", "-la"] }),
      output(3, "c1", "Exit code: 2\nboom"),
    ]);
    expect(run.spans[0]).toMatchObject({
      _tag: "ToolCall",
      tool: "shell",
      label: "ls -la",
      failed: true,
      start: 1,
      end: 3,
    });
  });

  test("the model's own time before an assistant message is thinking", () => {
    const { run } = decode([started(0), said(4, "assistant", "hi")]);
    expect(run.spans[0]).toMatchObject({ _tag: "Thinking", start: 0, end: 4 });
  });

  test("token counts become a turn with cached input split out and the window", () => {
    const { run } = decode([model(0), tokens(5, 1000, 600, 50)]);
    expect(run.turns[0]).toMatchObject({
      model: "gpt-5.5",
      usage: { input: 0 },
    });
    expect(run.turns[1]).toMatchObject({
      model: "gpt-5.5",
      window: 258_400,
      usage: { input: 400, cacheRead: 600, output: 50 },
    });
  });

  test("mcp tools become McpCall spans", () => {
    const { run } = decode([
      started(0),
      call(1, "c1", "mcp__linear__get_issue", {}),
      output(2, "c1", "ok"),
    ]);
    expect(run.spans[0]).toMatchObject({ _tag: "McpCall", server: "linear" });
  });

  test("context counts messages and tool output, and a compaction clears it", () => {
    const filled = decode([said(1, "user", "x".repeat(400))]).run.context;
    expect(filled[0]).toMatchObject({
      kind: "Message",
      label: "Messages",
      tokens: 100,
    });
    const cleared = decode([
      said(1, "user", "x".repeat(400)),
      { timestamp: "2026-01-01T00:00:02Z", type: "compacted", payload: {} },
    ]).run.context;
    expect(cleared).toEqual([]);
  });

  test("a completed task finishes the agent; junk lines are ignored", () => {
    const { run } = decode([
      started(0),
      finished(5),
      "nope",
      { type: 1 },
      null,
    ]);
    expect(run.finishes.at(0)).toMatchObject({ agentId: main, at: 5 });
  });
});
