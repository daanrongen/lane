import type { RunEvent } from "@/domain/events.ts";
import type { Run, Span } from "@/domain/run.ts";

const mapSpan = (run: Run, id: Span["id"], f: (s: Span) => Span): Run => ({
  ...run,
  spans: run.spans.map((s) => (s.id === id ? f(s) : s)),
});

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
      return { ...run, spans: [...run.spans, e.span] };
    case "SpanClosed":
      return mapSpan(run, e.spanId, (s) =>
        s._tag === "ToolCall" || s._tag === "McpCall"
          ? { ...s, end: e.at, failed: e.failed ?? s.failed }
          : { ...s, end: e.at },
      );
    case "TurnReported":
      return { ...run, turns: [...run.turns, e.turn] };
    case "ContextAdded":
      return { ...run, context: [...run.context, e.entry] };
    case "ContextCompacted":
      return {
        ...run,
        context: run.context.filter((c) => c.agentId !== e.agentId),
      };
    case "SkillUsed":
      return { ...run, skills: [...run.skills, e.use] };
    case "ModeChanged":
      return { ...run, modes: [...run.modes, e.change] };
    case "PlanReported":
      return { ...run, plans: [...run.plans, e.plan] };
    case "RequestMade":
      return { ...run, requests: [...run.requests, e.request] };
    case "SetupReported":
      return { ...run, setups: [...run.setups, e.setup] };
  }
};

export const foldAll = (run: Run, events: Iterable<RunEvent>): Run => {
  let r = run;
  for (const e of events) r = fold(r, e);
  return r;
};
