import type { Beat } from "@/adapters/memory/ScriptedRuns.ts";
import type { Approval, Edit } from "@/domain/act.ts";
import type { RunEvent } from "@/domain/events.ts";
import { ActId, AgentId, SpanId } from "@/domain/ids.ts";
import { mcpName } from "@/domain/mcp.ts";
import type { Ref } from "@/domain/ref.ts";
import type { Task, TaskSource, TaskStatus } from "@/domain/task.ts";
import { taskId } from "@/domain/task.ts";

export const main = AgentId("main");

let spans = 0;
const sid = () => SpanId(`s${++spans}`);

export const beat = (at: number, event: RunEvent): Beat => ({ at, event });

export const spawn = (
  id: AgentId,
  name: string,
  at: number,
  parentId: AgentId | null = main,
) => beat(at, { _tag: "AgentSpawned", agent: { id, parentId, name }, at });

export const finish = (agentId: AgentId, at: number) =>
  beat(at, { _tag: "AgentFinished", agentId, at });

export const think = (agentId: AgentId, start: number, end: number) => {
  const id = sid();
  return [
    beat(start, {
      _tag: "SpanOpened",
      span: { _tag: "Thinking", id, agentId, label: "thinking", start },
    }),
    beat(end, { _tag: "SpanClosed", spanId: id, at: end }),
  ];
};

// The parent waits on a child until it hands back; no `until` means it is still out.
export const delegate = (
  child: AgentId,
  name: string,
  from: number,
  until?: number,
  parent = main,
) => {
  const id = sid();
  return [
    spawn(child, name, from, parent),
    beat(from, {
      _tag: "SpanOpened",
      span: {
        _tag: "Waiting",
        id,
        agentId: parent,
        label: name,
        start: from,
        on: child,
      },
    }),
    ...(until === undefined
      ? []
      : [
          beat(until, { _tag: "SpanClosed", spanId: id, at: until }),
          finish(child, until),
        ]),
  ];
};

export interface Call {
  readonly end?: number;
  readonly fail?: string;
  readonly exit?: number;
  readonly touch?: readonly Ref[];
  readonly edit?: Edit;
  // Held for a decision from the start; `until` is when a person gave it.
  readonly ask?: { readonly until?: number };
  readonly deny?: Pick<Approval, "by">;
}

type Update = Omit<Extract<RunEvent, { _tag: "ActUpdated" }>, "_tag" | "id">;

export const call = (
  agentId: AgentId,
  tool: string,
  label: string,
  start: number,
  o: Call = {},
) => {
  const id = sid();
  const act = (at: number, u: Update) =>
    beat(at, { _tag: "ActUpdated", id: ActId(id), ...u });
  const base = { id, agentId, label, failed: false, start };
  const mcp = mcpName(tool);
  const { end } = o;
  return [
    beat(start, {
      _tag: "SpanOpened",
      span: mcp
        ? { ...base, _tag: "McpCall", ...mcp }
        : { ...base, _tag: "ToolCall", tool },
    }),
    ...(o.touch || o.edit
      ? [act(start, { touched: o.touch, edit: o.edit })]
      : []),
    ...(o.ask ? [act(start, { status: "awaiting" })] : []),
    ...(o.ask?.until === undefined
      ? []
      : [
          act(o.ask.until, {
            status: "running",
            approval: {
              by: "user",
              outcome: "allow",
              waited: o.ask.until - start,
            },
          }),
        ]),
    ...(end === undefined
      ? []
      : [
          beat(end, {
            _tag: "SpanClosed",
            spanId: id,
            at: end,
            failed: o.fail !== undefined,
            reason: o.fail,
          }),
        ]),
    ...(end !== undefined && o.exit !== undefined
      ? [act(end, { exit: o.exit })]
      : []),
    ...(end !== undefined && o.deny
      ? [
          act(end, {
            status: "denied",
            approval: { by: o.deny.by, outcome: "deny" },
          }),
        ]
      : []),
  ];
};

export const turn = (
  agentId: AgentId,
  at: number,
  model: string,
  context: number,
  window?: number,
) =>
  beat(at, {
    _tag: "TurnReported",
    turn: {
      agentId,
      at,
      model,
      window,
      usage: {
        input: Math.round(context * 0.1),
        output: 600,
        cacheRead: Math.round(context * 0.85),
        cacheWrite: Math.round(context * 0.05),
      },
    },
  });

export const mode = (
  agentId: AgentId,
  at: number,
  kind: "permission" | "approval" | "sandbox" | "effort",
  value: string,
) => beat(at, { _tag: "ModeChanged", change: { agentId, at, kind, value } });

export const skill = (agentId: AgentId, at: number, name: string) =>
  beat(at, { _tag: "SkillUsed", use: { agentId, at, name, via: "tool" } });

export const request = (
  agentId: AgentId,
  at: number,
  host: string,
  via: string,
  label = "",
) =>
  beat(at, {
    _tag: "RequestMade",
    request: { agentId, at, host, via, label },
  });

export const limit = (
  agentId: AgentId,
  at: number,
  window: string,
  used: number,
) =>
  beat(at, {
    _tag: "SignalReported",
    reading: { agentId, at, signal: { _tag: "Limit", window, used } },
  });

export const ctx = (
  agentId: AgentId,
  kind: "Message" | "File" | "Tool",
  label: string,
  tokens: number,
) =>
  beat(0, {
    _tag: "ContextAdded",
    entry: { agentId, at: 0, kind, label, tokens },
  });

export const setup = (agentId: AgentId, system: number, tools: string[]) =>
  beat(0, {
    _tag: "SetupReported",
    setup: {
      agentId,
      at: 0,
      system,
      tools: tools.map((name) => ({ name, tokens: 1_200 })),
    },
  });

export const compact = (agentId: AgentId, at: number) =>
  beat(at, { _tag: "ContextCompacted", agentId, at });

export const task = (
  source: TaskSource,
  owner: AgentId,
  title: string,
  status: TaskStatus,
  since = 0,
): Task => ({
  id: taskId(source, owner, title),
  title,
  status,
  source,
  owner,
  since,
});
