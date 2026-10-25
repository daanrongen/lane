import { describe, expect, test } from "bun:test";
import {
  decodeAll,
  makeDecoder,
  spawnRegistry,
  spawnsFrom,
} from "@/adapters/claude/decode.ts";
import {
  assistant,
  iso,
  origin,
  result,
  toolUse,
} from "@/adapters/claude/fixtures.ts";
import type { RunEvent } from "@/domain/events.ts";
import { foldAll } from "@/domain/fold.ts";
import { AgentId, SpanId, ThreadId } from "@/domain/ids.ts";
import { emptyRun } from "@/domain/run.ts";
import { timeline } from "@/domain/timeline.ts";

const main = AgentId("main");
const none = () => undefined;
const cfg = { origin, agentId: main, spawns: none };

describe("makeDecoder", () => {
  test("tool call opens and closes, errors mark failure", () => {
    const events = decodeAll(cfg, [
      assistant(1, "m1", [toolUse("t1", "Grep", { pattern: "foo" })]),
      result(3, "t1", true),
    ]);
    expect(
      events.filter(
        (e) => e._tag.startsWith("Span") || e._tag === "AgentFinished",
      ),
    ).toEqual([
      {
        _tag: "SpanOpened",
        span: {
          _tag: "ToolCall",
          id: SpanId("t1"),
          agentId: main,
          label: "foo",
          tool: "Grep",
          failed: false,
          start: 1,
        },
      },
      { _tag: "SpanClosed", spanId: SpanId("t1"), at: 3, failed: true },
      { _tag: "AgentFinished", agentId: main, at: 3 },
    ]);
  });

  test("one turn per message id even though each block is a line", () => {
    const events = decodeAll(cfg, [
      assistant(1, "m1", [{ type: "text" }]),
      assistant(2, "m1", [toolUse("t1", "Bash")]),
      assistant(3, "m2", [{ type: "text" }]),
    ]);
    const turns = events.filter((e) => e._tag === "TurnReported");
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({
      turn: {
        at: 1,
        model: "m",
        usage: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 },
      },
    });
  });

  test("a synthetic placeholder message is not a turn", () => {
    const line = assistant(1, "m1", [{ type: "text" }]);
    const synthetic = {
      ...line,
      message: { ...line.message, model: "<synthetic>" },
    };
    const events = decodeAll(cfg, [synthetic]);
    expect(events.some((e) => e._tag === "TurnReported")).toBe(false);
  });

  test("thinking spans run from the previous event to the block", () => {
    const events = decodeAll(cfg, [
      result(2, "x"),
      assistant(5, "m1", [{ type: "thinking" }]),
    ]);
    expect(events.find((e) => e._tag === "SpanOpened")).toMatchObject({
      span: { _tag: "Thinking", start: 2 },
    });
    expect(events.find((e) => e._tag === "SpanClosed")).toMatchObject({
      at: 5,
    });
  });

  test("announces self once, on the first valid line", () => {
    const self = { id: main, parentId: null, name: "main" };
    const events = decodeAll({ ...cfg, self }, [
      "garbage",
      assistant(4, "m1", [{ type: "text" }]),
      assistant(5, "m2", [{ type: "text" }]),
    ]);
    const spawned = events.filter((e) => e._tag === "AgentSpawned");
    expect(spawned).toEqual([{ _tag: "AgentSpawned", agent: self, at: 4 }]);
  });

  test("ignores malformed lines without throwing", () => {
    const d = makeDecoder(cfg);
    const bad = [
      null,
      "x",
      7,
      [],
      {},
      { type: "attachment", timestamp: iso(1), message: {} },
      { type: "user", timestamp: "nope", message: {} },
      { type: "user", timestamp: iso(1) },
    ];
    expect(bad.flatMap((l) => d.push(l))).toEqual([]);
  });

  test("an end_turn message finishes the agent once, however many blocks", () => {
    const d = makeDecoder(cfg);
    const finished = (events: RunEvent[]) =>
      events.filter((e) => e._tag === "AgentFinished");
    expect(
      finished(d.push(assistant(1, "m1", [{ type: "text" }]))),
    ).toHaveLength(0);
    expect(
      finished(d.push(assistant(2, "m2", [{ type: "thinking" }], "end_turn"))),
    ).toEqual([{ _tag: "AgentFinished", agentId: main, at: 2 }]);
    expect(
      finished(d.push(assistant(3, "m2", [{ type: "text" }], "end_turn"))),
    ).toHaveLength(0);
  });

  test("a SubagentHandback call finishes the agent", () => {
    const d = makeDecoder(cfg);
    const events = d.push(
      assistant(2, "m1", [toolUse("t1", "SubagentHandback")]),
    );
    expect(events).toContainEqual({
      _tag: "AgentFinished",
      agentId: main,
      at: 2,
    });
  });

  test("end closes dangling spans and finishes the agent", () => {
    const d = makeDecoder(cfg);
    d.push(assistant(1, "m1", [toolUse("t1", "Bash")]));
    d.push(assistant(6, "m2", [{ type: "text" }]));
    expect(d.end()).toEqual([
      { _tag: "SpanClosed", spanId: SpanId("t1"), at: 6 },
      { _tag: "AgentFinished", agentId: main, at: 6 },
    ]);
  });
});

describe("sub-agents", () => {
  const sub = AgentId("sub");
  const spawns = spawnsFrom([
    [sub, { toolUseId: "ag1", agentType: "Explore", description: "scan" }],
  ]);

  test("a known Agent call becomes a spawn plus a waiting span", () => {
    const events = decodeAll({ ...cfg, spawns }, [
      assistant(1, "m1", [toolUse("ag1", "Agent", { description: "x" })]),
    ]);
    const opened = events.filter(
      (e) => e._tag === "AgentSpawned" || e._tag === "SpanOpened",
    );
    expect(opened).toMatchObject([
      {
        _tag: "AgentSpawned",
        agent: { id: sub, parentId: main, name: "Explore" },
        at: 1,
      },
      { _tag: "SpanOpened", span: { _tag: "Waiting", on: sub, label: "scan" } },
    ]);
  });

  test("an Agent call without meta degrades to a tool call", () => {
    const events = decodeAll(cfg, [
      assistant(1, "m1", [toolUse("ag1", "Agent", { description: "x" })]),
    ]);
    expect(events.find((e) => e._tag === "SpanOpened")).toMatchObject({
      span: { _tag: "ToolCall", tool: "Agent" },
    });
  });

  test("a spawn whose meta arrives late resolves at its original time", () => {
    const registry = spawnRegistry();
    const d = makeDecoder({ ...cfg, spawns: registry.lookup });
    expect(d.push(assistant(1, "m1", [toolUse("ag1", "Agent")]))).toHaveLength(
      2, // turn and context: the spawn is held back
    );
    registry.add(sub, { toolUseId: "ag1", agentType: "Explore" });
    const events = d.push(assistant(4, "m2", [{ type: "text" }]));
    expect(events.map((e) => e._tag)).toEqual([
      "AgentSpawned",
      "SpanOpened",
      "TurnReported",
    ]);
    expect(events[0]).toMatchObject({ at: 1 });
  });

  test("a result that arrives before the meta degrades to a tool call", () => {
    const d = makeDecoder(cfg);
    d.push(assistant(1, "m1", [toolUse("ag1", "Agent")]));
    const events = d.push(result(2, "ag1"));
    expect(events.map((e) => e._tag)).toEqual(["SpanOpened", "SpanClosed"]);
  });

  test("parent and child transcripts fold into one timeline", () => {
    const self = { id: main, parentId: null, name: "main" };
    const parent = decodeAll({ ...cfg, self, spawns }, [
      assistant(1, "m1", [toolUse("ag1", "Agent")]),
      result(2, "ag1"),
      assistant(9, "m2", [{ type: "text" }]),
    ]);
    const child = decodeAll({ origin, agentId: sub, spawns: none }, [
      assistant(3, "c1", [toolUse("c-t1", "Read")]),
      result(5, "c-t1"),
      assistant(7, "c2", [{ type: "text" }]),
    ]);

    const tl = timeline(
      foldAll(emptyRun(ThreadId("s"), origin), [...parent, ...child]),
      9,
    );

    expect(tl.lanes.map((l) => [l.agent.name, l.depth, l.bars.length])).toEqual(
      [
        ["main", 0, 1],
        ["Explore", 1, 1],
      ],
    );
    expect(tl.links).toEqual([{ from: main, to: sub, at: 1, returnedAt: 7 }]);
    expect(tl.usage.input).toBe(4);
  });
});

describe("context entries", () => {
  const entries = (lines: unknown[]) =>
    decodeAll(cfg, lines).flatMap((e) =>
      e._tag === "ContextAdded" ? [e.entry] : [],
    );

  test("text and tool results are sized at four characters a token", () => {
    const out = entries([
      { ...assistant(1, "m1", [{ type: "text", text: "a".repeat(40) }]) },
      assistant(2, "m2", [toolUse("t1", "Bash")]),
      {
        type: "user",
        timestamp: iso(3),
        message: {
          content: [
            { type: "tool_result", tool_use_id: "t1", content: "b".repeat(80) },
          ],
        },
      },
    ]);
    expect(out.map((e) => [e.kind, e.label, e.tokens])).toEqual([
      ["Message", "Messages", 10],
      ["Tool", "Bash", 1],
      ["Tool", "Bash", 20],
    ]);
  });

  test("file tools group by their last two directories", () => {
    const out = entries([
      assistant(1, "m1", [
        toolUse("t1", "Read", { file_path: "/p/src/api/users/get.ts" }),
      ]),
    ]);
    expect(out[0]).toMatchObject({ kind: "File", label: "api/users/" });
  });

  test("a prompt typed as a plain string counts as a message", () => {
    const out = entries([
      {
        type: "user",
        timestamp: iso(1),
        message: { content: "x".repeat(8) },
      },
    ]);
    expect(out).toMatchObject([{ kind: "Message", tokens: 2 }]);
  });
});

describe("setup, compaction and mcp", () => {
  test("a prompt snapshot with tools reports the setup", () => {
    const events = decodeAll(cfg, [
      {
        type: "attachment",
        timestamp: iso(1),
        attachment: {
          type: "prompt_snapshot",
          systemPrompt: ["a".repeat(40), "b".repeat(40)],
          tools: [{ name: "Bash", description: "x" }],
        },
      },
    ]);
    expect(events[0]).toMatchObject({
      _tag: "SetupReported",
      setup: { system: 20, tools: [{ name: "Bash" }] },
    });
  });

  test("a snapshot without tools is ignored", () => {
    const line = {
      type: "attachment",
      timestamp: iso(1),
      attachment: { type: "prompt_snapshot", systemPrompt: ["x"] },
    };
    expect(decodeAll(cfg, [line]).map((e) => e._tag)).toEqual([
      "AgentFinished",
    ]);
  });

  test("a compact boundary drops what came before it", () => {
    const events = decodeAll(cfg, [
      assistant(1, "m1", [{ type: "text", text: "x".repeat(400) }]),
      { type: "system", subtype: "compact_boundary", timestamp: iso(2) },
    ]);
    const run = foldAll(emptyRun(ThreadId("s"), 0), events);
    expect(run.context).toEqual([]);
  });

  test("mcp tools become McpCall spans with their server", () => {
    const events = decodeAll(cfg, [
      assistant(1, "m1", [toolUse("t1", "mcp__linear__list_issues", {})]),
      result(2, "t1", true),
    ]);
    const run = foldAll(emptyRun(ThreadId("s"), 0), events);
    expect(run.spans[0]).toMatchObject({
      _tag: "McpCall",
      server: "linear",
      tool: "list_issues",
      failed: true,
    });
  });
});

describe("network requests", () => {
  const requests = (lines: unknown[]) =>
    foldAll(emptyRun(ThreadId("s"), 0), decodeAll(cfg, lines)).requests;

  test("WebFetch, WebSearch and urls in shell commands are requests", () => {
    const out = requests([
      assistant(1, "m1", [
        toolUse("t1", "WebFetch", { url: "https://docs.x.dev/a" }),
        toolUse("t2", "WebSearch", { query: "bun compile" }),
        toolUse("t3", "Bash", { command: "curl -s https://api.y.io/v1" }),
        toolUse("t4", "Bash", { command: "git push" }),
        toolUse("t5", "Bash", { command: "ls" }),
      ]),
    ]);
    expect(out.map((r) => [r.host, r.via])).toEqual([
      ["docs.x.dev", "WebFetch"],
      ["web search", "WebSearch"],
      ["api.y.io", "Bash"],
      ["git", "Bash"],
    ]);
  });
});

describe("how the work is steered", () => {
  const fold = (lines: unknown[]) =>
    foldAll(emptyRun(ThreadId("s"), 0), decodeAll(cfg, lines));

  test("a Skill call is a skill use", () => {
    const run = fold([
      assistant(1, "m1", [toolUse("t1", "Skill", { skill: "obsidian" })]),
    ]);
    expect(run.skills).toEqual([
      { agentId: main, at: 1, name: "obsidian", via: "tool" },
    ]);
  });

  test("permission mode changes are recorded once each", () => {
    const run = fold([
      assistant(1, "m1", [{ type: "text" }]),
      { type: "permission-mode", permissionMode: "plan" },
      { type: "permission-mode", permissionMode: "plan" },
      assistant(4, "m2", [{ type: "text" }]),
      { type: "permission-mode", permissionMode: "auto" },
    ]);
    expect(run.modes.map((m) => [m.value, m.at])).toEqual([
      ["plan", 1],
      ["auto", 4],
    ]);
  });

  test("a turn knows its provider", () => {
    const run = fold([
      {
        ...assistant(1, "m1", [{ type: "text" }]),
        message: { id: "m1", model: "gpt-oss:20b", content: [], usage: {} },
      },
    ]);
    expect(run.turns[0]?.provider).toBe("ollama");
  });
});

describe("what the result and the turn say", () => {
  const withDecision = (id: string, permissionDecision: object) => ({
    ...result(3, id),
    permissionDecision,
  });

  test("who let a call through becomes its approval", () => {
    const run = foldAll(
      emptyRun(ThreadId("t"), 0),
      decodeAll(cfg, [
        assistant(1, "m1", [
          toolUse("a", "Bash", { command: "ls" }),
          toolUse("b", "Bash", { command: "rm x" }),
        ]),
        withDecision("a", {
          decision: "accept",
          source: "config",
          reasonType: "rule",
          ruleSource: "userSettings",
        }),
        withDecision("b", { decision: "reject", source: "user_reject" }),
      ]),
    );
    expect(run.acts.map((a) => a.approval)).toEqual([
      { by: "rule", rule: "userSettings", outcome: "allow" },
      { by: "user", outcome: "deny" },
    ]);
  });

  test("a classifier or a mode decides for the policy", () => {
    const run = foldAll(
      emptyRun(ThreadId("t"), 0),
      decodeAll(cfg, [
        assistant(1, "m1", [toolUse("a", "Bash"), toolUse("b", "Bash")]),
        withDecision("a", {
          decision: "accept",
          reasonType: "classifier",
        }),
        withDecision("b", { decision: "accept", reasonType: "mode" }),
      ]),
    );
    expect(run.acts.map((a) => a.approval?.by)).toEqual([
      "classifier",
      "policy",
    ]);
  });

  test("effort is a mode, reported when it changes", () => {
    const at = (s: number, id: string, effort: string) => ({
      ...assistant(s, id, [{ type: "text" }]),
      effort,
    });
    const modes = decodeAll(cfg, [
      at(1, "m1", "medium"),
      at(2, "m2", "medium"),
      at(3, "m3", "high"),
    ]).filter((e) => e._tag === "ModeChanged");
    expect(modes.map((m) => m.change.value)).toEqual(["medium", "high"]);
  });

  test("ExitPlanMode proposes a plan, and the answer decides it", () => {
    const plan = "# Add tiers\n- schema\n- api\n2. ui";
    const exit = (isError: boolean) =>
      foldAll(
        emptyRun(ThreadId("t"), 0),
        decodeAll(cfg, [
          assistant(1, "m1", [toolUse("p", "ExitPlanMode", { plan })]),
          result(5, "p", isError),
        ]),
      ).plans[0];
    expect(exit(false)).toMatchObject({
      title: "Add tiers",
      steps: ["schema", "api", "ui"],
      status: "approved",
    });
    expect(exit(true)?.status).toBe("rejected");
  });
});

describe("hooks", () => {
  const hook = (s: number, attachment: object) => ({
    type: "attachment",
    timestamp: iso(s),
    uuid: `h${s}`,
    attachment,
  });
  const acts = (lines: unknown[]) =>
    foldAll(emptyRun(ThreadId("t"), 0), decodeAll(cfg, lines)).acts;

  test("a hook that blocked is a failed act of class hook", () => {
    const [act] = acts([
      hook(5, {
        type: "hook_blocking_error",
        hookName: "PreToolUse:Bash",
        command: "guard.sh",
        stderr: "no force pushes\nsee policy",
        exitCode: 2,
      }),
    ]);
    expect(act).toMatchObject({
      tool: "hook",
      label: "PreToolUse:Bash: guard.sh",
      status: "failed",
      failure: { class: "hook", reason: "no force pushes" },
      exit: 2,
    });
  });

  test("a slow hook shows, a quick one that passed does not", () => {
    const pass = (ms: number) => ({
      type: "hook_success",
      hookName: "PostToolUse:Edit",
      command: "fmt.sh",
      durationMs: ms,
    });
    expect(acts([hook(5, pass(40))])).toHaveLength(0);
    const [slow] = acts([hook(9, pass(3_000))]);
    expect(slow).toMatchObject({ status: "ok", start: 6, end: 9 });
  });
});
