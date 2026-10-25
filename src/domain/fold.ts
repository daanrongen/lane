import { type Act, actKind, failureOf, needsPerson } from "@/domain/act.ts";
import type { RunEvent } from "@/domain/events.ts";
import { ActId } from "@/domain/ids.ts";
import { mcp } from "@/domain/ref.ts";
import type { Run, Span } from "@/domain/run.ts";

const mapSpan = (run: Run, id: Span["id"], f: (s: Span) => Span): Run => ({
  ...run,
  spans: run.spans.map((s) => (s.id === id ? f(s) : s)),
});

const mapAct = (run: Run, id: Act["id"], f: (a: Act) => Act): Run => ({
  ...run,
  acts: run.acts.map((a) => (a.id === id ? f(a) : a)),
});

// A span is the act as the harness first shows it; touches arrive as updates.
const actOf = (s: Span): Act => {
  const base = {
    id: ActId(s.id),
    agentId: s.agentId,
    label: s.label,
    start: s.start,
    end: s.end,
    touches: [],
    fidelity: "observed",
  } as const;
  const state = (kind: Act["kind"], failed = false) =>
    ({
      status:
        s.end === undefined
          ? needsPerson(kind)
            ? "awaiting"
            : "running"
          : failed
            ? "failed"
            : "ok",
    }) as const;
  switch (s._tag) {
    case "Thinking":
      return { ...base, kind: "think", ...state("think") };
    case "Waiting":
      return { ...base, kind: "spawn", ...state("spawn") };
    case "McpCall":
      return {
        ...base,
        kind: "mcp",
        tool: s.tool,
        touches: [mcp(s.server, s.tool)],
        ...state("mcp", s.failed),
      };
    case "ToolCall": {
      const kind = actKind(s.tool);
      return {
        ...base,
        kind,
        tool: s.tool,
        edit:
          kind === "edit"
            ? { op: s.tool === "Write" ? "create" : "modify" }
            : undefined,
        ...state(kind, s.failed),
      };
    }
  }
};

export const fold = (run: Run, e: RunEvent): Run => {
  switch (e._tag) {
    case "RunStarted":
      return { ...run, startedAt: e.startedAt };
    case "AgentSpawned":
      return {
        ...run,
        agents: [...run.agents, e.agent],
        handoffs: e.agent.parentId
          ? [
              ...run.handoffs,
              { from: e.agent.parentId, to: e.agent.id, at: e.at },
            ]
          : run.handoffs,
      };
    case "AgentFinished":
      return {
        ...run,
        finishes: [...run.finishes, { agentId: e.agentId, at: e.at }],
      };
    case "SpanOpened":
      return {
        ...run,
        spans: [...run.spans, e.span],
        acts: [...run.acts, actOf(e.span)],
      };
    case "SpanClosed": {
      const closed = mapSpan(run, e.spanId, (s) =>
        s._tag === "ToolCall" || s._tag === "McpCall"
          ? {
              ...s,
              end: e.at,
              failed: e.failed ?? s.failed,
              reason: e.reason ?? s.reason,
            }
          : { ...s, end: e.at },
      );
      return mapAct(closed, ActId(e.spanId), (a) => ({
        ...a,
        end: e.at,
        status: e.failed ? "failed" : "ok",
        failure: e.failed ? failureOf(e.reason) : undefined,
      }));
    }
    case "TurnReported":
      return { ...run, turns: [...run.turns, e.turn] };
    case "ContextAdded":
      return { ...run, context: [...run.context, e.entry] };
    case "ContextCompacted":
      return {
        ...run,
        context: run.context.filter((c) => c.agentId !== e.agentId),
        acts: [
          ...run.acts,
          {
            id: ActId(`compact:${e.agentId}:${e.at}`),
            agentId: e.agentId,
            kind: "compact",
            label: "compacted",
            start: e.at,
            end: e.at,
            status: "ok",
            touches: [],
            fidelity: "observed",
          },
        ],
      };
    case "SkillUsed":
      return { ...run, skills: [...run.skills, e.use] };
    case "ModeChanged":
      return { ...run, modes: [...run.modes, e.change] };
    case "RequestMade":
      return { ...run, requests: [...run.requests, e.request] };
    case "SetupReported":
      return { ...run, setups: [...run.setups, e.setup] };
    case "ActOpened":
      return { ...run, acts: [...run.acts, e.act] };
    case "ActUpdated":
      return mapAct(run, e.id, (a) => ({
        ...a,
        end: e.end ?? a.end,
        status: e.status ?? a.status,
        failure: e.failure ?? a.failure,
        edit: e.edit ?? a.edit,
        approval: e.approval ?? a.approval,
        exit: e.exit ?? a.exit,
        touches: e.touched ? [...a.touches, ...e.touched] : a.touches,
      }));
    case "SignalReported":
      return { ...run, readings: [...run.readings, e.reading] };
    case "LinkMade":
      return { ...run, links: [...run.links, e.link] };
    case "PlanProposed":
      return { ...run, plans: [...run.plans, e.plan] };
    case "PlanDecided":
      return {
        ...run,
        plans: run.plans.map((p) =>
          p.id === e.id ? { ...p, status: e.status } : p,
        ),
      };
  }
};

export const foldAll = (run: Run, events: Iterable<RunEvent>): Run => {
  let r = run;
  for (const e of events) r = fold(r, e);
  return r;
};
