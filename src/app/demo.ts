import type { RunEvent } from "@/domain/events.ts";
import { AgentId, SessionId, SpanId } from "@/domain/ids.ts";
import type { Session } from "@/domain/session.ts";

export const demoSession: Session = {
  harness: "claude",
  id: SessionId("demo"),
  cwd: "~/Developer/checkout",
  pid: 1,
  status: "busy",
  name: "checkout-conversion-drop",
  updatedAt: 0,
};

export const demoCodexSession: Session = {
  harness: "codex",
  id: SessionId("demo-codex"),
  cwd: "~/Developer/portfolio",
  status: "idle",
  updatedAt: -1,
};

const main = AgentId("orchestrator");
const checker = AgentId("checker");
const researcher = AgentId("researcher");
const analyst = AgentId("analyst");
const writer = AgentId("writer");

let n = 0;
const next = () => SpanId(`s${++n}`);

const thinking = (agentId: AgentId, start: number, end: number): RunEvent[] => {
  const id = next();
  return [
    {
      _tag: "SpanOpened",
      span: { _tag: "Thinking", id, agentId, label: "thinking", start },
    },
    { _tag: "SpanClosed", spanId: id, at: end },
  ];
};

const tool = (
  agentId: AgentId,
  name: string,
  start: number,
  end: number,
  failed = false,
): RunEvent[] => {
  const id = next();
  return [
    {
      _tag: "SpanOpened",
      span: {
        _tag: "ToolCall",
        id,
        agentId,
        label: name,
        tool: name,
        failed: false,
        start,
      },
    },
    { _tag: "SpanClosed", spanId: id, at: end, failed },
  ];
};

const mcp = (
  agentId: AgentId,
  server: string,
  tool: string,
  start: number,
  end: number,
): RunEvent[] => {
  const id = next();
  return [
    {
      _tag: "SpanOpened",
      span: {
        _tag: "McpCall",
        id,
        agentId,
        label: tool,
        server,
        tool,
        failed: false,
        start,
      },
    },
    { _tag: "SpanClosed", spanId: id, at: end },
  ];
};

// The orchestrator hands work to `to` and waits until `to` finishes.
const delegate = (
  to: AgentId,
  name: string,
  from: number,
  until: number,
): RunEvent[] => {
  const id = next();
  return [
    { _tag: "AgentSpawned", agent: { id: to, parentId: main, name }, at: from },
    {
      _tag: "SpanOpened",
      span: {
        _tag: "Waiting",
        id,
        agentId: main,
        label: name,
        start: from,
        on: to,
      },
    },
    { _tag: "SpanClosed", spanId: id, at: until },
    { _tag: "AgentFinished", agentId: to, at: until },
  ];
};

const turn = (
  agentId: AgentId,
  at: number,
  model: string,
  input: number,
  output: number,
): RunEvent => ({
  _tag: "TurnReported",
  turn: {
    agentId,
    at,
    model,
    usage: { input, output, cacheRead: input * 8, cacheWrite: input },
  },
});

const ctx = (
  agentId: AgentId,
  kind: "Message" | "File" | "Tool",
  label: string,
  tokens: number,
): RunEvent => ({
  _tag: "ContextAdded",
  entry: { agentId, at: 0, kind, label, tokens },
});

export const demoEvents: readonly RunEvent[] = [
  { _tag: "RunStarted", startedAt: Date.parse("2026-01-01T09:00:00Z") },
  {
    _tag: "AgentSpawned",
    agent: { id: main, parentId: null, name: "Orchestrator" },
    at: 0,
  },
  ...thinking(main, 0, 2),
  ...delegate(checker, "Checker", 2.5, 9.5),
  ...delegate(researcher, "Researcher", 2.5, 12),
  ...delegate(analyst, "Analyst", 2, 14.5),
  ...thinking(main, 14.5, 16.5),
  ...delegate(writer, "Writer", 16.5, 23),
  ...thinking(main, 23, 24.7),

  ...thinking(checker, 3.5, 4.5),
  ...tool(checker, "Grep", 4.5, 6),
  ...thinking(checker, 6, 7),
  ...tool(checker, "Read", 7, 9),

  ...thinking(researcher, 3, 4),
  ...tool(researcher, "WebSearch", 4, 7),
  ...thinking(researcher, 7, 8),
  ...tool(researcher, "WebFetch", 8, 11.5),
  ...mcp(researcher, "linear", "search_issues", 11.5, 12),

  ...thinking(analyst, 2.5, 3.5),
  ...tool(analyst, "Bash", 3.5, 5, true),
  ...mcp(analyst, "datadog", "query_metrics", 5.5, 8),
  ...thinking(analyst, 8, 9.5),
  ...tool(analyst, "Read", 9.5, 12),
  ...thinking(analyst, 12, 14),

  ...thinking(writer, 17, 18),
  ...tool(writer, "Write", 18, 21),
  ...thinking(writer, 21, 22.5),

  turn(main, 24, "claude-opus-5-5", 5_000, 900),
  turn(checker, 9, "claude-sonnet-5-5", 2_000, 400),
  turn(researcher, 12, "claude-sonnet-5-5", 4_000, 700),
  turn(analyst, 14, "claude-haiku-5-5", 1_500, 600),
  turn(writer, 22.5, "claude-sonnet-5-5", 2_500, 1_200),

  {
    _tag: "SetupReported",
    setup: {
      agentId: main,
      at: 0,
      system: 6_200,
      tools: [
        { name: "Agent", tokens: 1_900 },
        { name: "Bash", tokens: 1_400 },
        { name: "Read", tokens: 1_100 },
        { name: "mcp__linear__search_issues", tokens: 1_800 },
        { name: "mcp__linear__get_issue", tokens: 1_200 },
        { name: "mcp__datadog__query_metrics", tokens: 2_100 },
      ],
    },
  },
  ctx(main, "Message", "Messages", 4_200),
  ctx(main, "Tool", "Agent", 3_100),
  ctx(main, "File", "src/api/", 6_100),
  ctx(main, "File", "src/checkout/", 3_400),
  ctx(main, "Tool", "Bash", 2_200),
  ctx(main, "Tool", "Grep", 1_400),
  ctx(checker, "Message", "Messages", 2_100),
  ctx(checker, "Tool", "Grep", 3_000),
  ctx(checker, "File", "src/api/", 5_200),
  ctx(researcher, "Message", "Messages", 5_000),
  ctx(researcher, "Tool", "WebSearch", 6_500),
  ctx(researcher, "Tool", "WebFetch", 14_000),
  ctx(analyst, "Message", "Messages", 1_800),
  ctx(analyst, "Tool", "Bash", 4_200),
  ctx(analyst, "File", "src/checkout/", 3_600),
  ctx(writer, "Message", "Messages", 3_000),
  ctx(writer, "Tool", "Write", 5_500),
];

const codex = AgentId("codex");

// A single-agent Codex run: no hand-offs, a failed test run, a patch.
export const demoCodexEvents: readonly RunEvent[] = [
  { _tag: "RunStarted", startedAt: Date.parse("2026-01-01T09:30:00Z") },
  {
    _tag: "AgentSpawned",
    agent: { id: codex, parentId: null, name: "codex" },
    at: 0,
  },
  ...thinking(codex, 0, 2),
  ...tool(codex, "shell", 2, 3.5),
  ...thinking(codex, 3.5, 5),
  ...tool(codex, "apply_patch", 5, 6),
  ...tool(codex, "shell", 6, 11, true),
  ...thinking(codex, 11, 13),
  ...tool(codex, "apply_patch", 13, 14),
  ...tool(codex, "shell", 14, 18),
  { _tag: "AgentFinished", agentId: codex, at: 18 },
  {
    _tag: "TurnReported",
    turn: {
      agentId: codex,
      at: 18,
      model: "gpt-5.5",
      window: 258_400,
      usage: { input: 14_000, output: 2_100, cacheRead: 61_000, cacheWrite: 0 },
    },
  },
  {
    _tag: "SetupReported",
    setup: { agentId: codex, at: 0, system: 5_800, tools: [] },
  },
  ctx(codex, "Message", "Messages", 6_400),
  ctx(codex, "Tool", "shell", 18_200),
  ctx(codex, "Tool", "apply_patch", 7_300),
  ctx(codex, "Message", "Thinking", 9_100),
];
