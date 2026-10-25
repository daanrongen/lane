import { useMemo } from "react";
import type { Act } from "@/domain/act.ts";
import type { Asset } from "@/domain/assets.ts";
import { contextMap } from "@/domain/context.ts";
import type { AgentView, Floor } from "@/domain/floor.ts";
import { agentOf } from "@/domain/ids.ts";
import { mcpServers } from "@/domain/mcp.ts";
import { hosts } from "@/domain/network.ts";
import type { Run } from "@/domain/run.ts";
import { skillsUsed } from "@/domain/skills.ts";
import type { Task } from "@/domain/task.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { clip, exact, modelName } from "@/ui/lib/format.ts";
import { stateLook } from "@/ui/lib/look.ts";
import { skillChips } from "@/ui/lib/usageRows.ts";
import { ContextMap } from "@/ui/organisms/ContextMap.tsx";
import { MachinePanel } from "@/ui/organisms/MachinePanel.tsx";
import { McpServers } from "@/ui/organisms/McpServers.tsx";
import { NetworkHosts } from "@/ui/organisms/NetworkHosts.tsx";
import { UsageRow } from "@/ui/organisms/UsageRow.tsx";

const ACTS = 8;

const Heading = ({ children }: { children: string }) => (
  <Text size="small" tone="dim">
    {children}
  </Text>
);

const ActLine = ({ act, now }: { act: Act; now: number }) => {
  const r = useMetrics();
  const theme = useTheme();
  const bad = act.status === "failed" || act.status === "denied";
  const open = act.end === undefined;
  const waiting = act.status === "awaiting";
  return (
    <Column>
      <Row gap={r.dot}>
        <Text size="small" tone={bad ? "failed" : open ? "running" : "dim"}>
          {bad ? "✕" : waiting ? "◆" : open ? "●" : "✓"}
        </Text>
        <Text size="small" tone="dim" style={{ width: r.charWidth * 6 }}>
          {act.kind}
        </Text>
        <Text size="small" style={{ flexGrow: 1, minWidth: 0 }}>
          {act.label}
        </Text>
        <Text size="small" tone="dim">
          {exact((act.end ?? now) - act.start)}
        </Text>
      </Row>
      {act.failure ? (
        <Text size="small" style={{ color: theme.failed }}>
          {`${act.failure.class}: ${clip(act.failure.reason, 60)}`}
        </Text>
      ) : null}
    </Column>
  );
};

const Now = ({
  agent,
  run,
  now,
}: {
  agent: AgentView;
  run: Run;
  now: number;
}) => {
  const r = useMetrics();
  const acts = run.acts
    .filter((a) => a.agentId === agentOf(agent.ref) && a.kind !== "think")
    .slice(-ACTS)
    .reverse();
  return (
    <Column gap={Math.round(r.dot / 2)}>
      <Heading>NOW</Heading>
      <Text size="small" tone="dim">
        {[
          agent.harness,
          agent.model && modelName(agent.model),
          ...Object.entries(agent.modes).map(([k, v]) => `${k} ${v}`),
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {acts.map((a) => (
        <ActLine key={a.id} act={a} now={now} />
      ))}
    </Column>
  );
};

const GLYPH = { done: "✓", doing: "●", next: "○" } as const;

const Plan = ({
  run,
  agent,
  tasks,
}: {
  run: Run;
  agent: AgentView;
  tasks: readonly Task[];
}) => {
  const r = useMetrics();
  const id = agentOf(agent.ref);
  const plan = run.plans.findLast((p) => p.agentId === id);
  const own = tasks.filter((t) => t.owner === id);
  return (
    <Column gap={Math.round(r.dot / 2)}>
      <Heading>PLAN</Heading>
      {plan ? (
        <>
          <Text size="small">{`${plan.title} (${plan.status})`}</Text>
          {plan.steps.map((s) => (
            <Text key={s} size="small" tone="dim">
              {`· ${s}`}
            </Text>
          ))}
        </>
      ) : null}
      {own.map((t) => (
        <Text
          key={t.id}
          size="small"
          tone={t.status === "done" ? "dim" : "text"}
        >
          {`${GLYPH[t.status]} ${t.title}`}
        </Text>
      ))}
      {!plan && own.length === 0 ? (
        <Text size="small" tone="dim">
          nothing reported
        </Text>
      ) : null}
    </Column>
  );
};

// The selected agent side by side: what it is doing, what fills its context, what it intends, how it is set up.
export const DetailPanel = ({
  floor,
  agent,
  run,
  tasks,
  assets,
  now,
  width,
}: {
  floor: Floor;
  agent?: AgentView;
  run?: Run;
  tasks: readonly Task[];
  assets: readonly Asset[];
  now: number;
  width: number;
}) => {
  const r = useMetrics();
  const id = agent && agentOf(agent.ref);
  const map = useMemo(
    () =>
      run && agent?.fill?.window
        ? contextMap(
            run.context.filter((e) => e.agentId === id),
            run.setups.findLast((s) => s.agentId === id),
            agent.fill.used,
            agent.fill.window,
          )
        : undefined,
    [run, agent, id],
  );
  const skills = useMemo(
    () =>
      run
        ? skillChips(
            skillsUsed(run.skills.filter((s) => s.agentId === id)),
            assets,
          )
        : [],
    [run, id, assets],
  );
  const theme = useTheme();
  if (!agent) return <MachinePanel floor={floor} width={width} />;
  if (!run) {
    return (
      <Text tone="dim" style={{ paddingLeft: r.dot }}>
        no transcript for this agent
      </Text>
    );
  }
  const col = r.compact ? width : Math.floor((width - r.pad * 3) / 4);
  const look = stateLook(agent.state, theme);
  return (
    <Column gap={r.dot}>
      <Row gap={r.dot} style={{ paddingLeft: r.dot }}>
        <Text
          style={{ color: look.color }}
        >{`${look.glyph} ${agent.name}`}</Text>
        <Text size="small" tone="dim">
          {agent.state}
        </Text>
      </Row>
      <Row
        gap={r.pad}
        align="flex-start"
        style={{
          flexDirection: r.compact ? "column" : "row",
          paddingLeft: r.dot,
        }}
      >
        <Column style={{ width: col }}>
          <Now agent={agent} run={run} now={(now - run.startedAt) / 1000} />
        </Column>
        <Column style={{ width: col }}>
          {map ? (
            <ContextMap map={map} agent={agent.name} width={col} />
          ) : (
            <>
              <Heading>CONTEXT</Heading>
              <Text size="small" tone="dim">
                n/a
              </Text>
            </>
          )}
        </Column>
        <Column style={{ width: col }}>
          <Plan run={run} agent={agent} tasks={tasks} />
        </Column>
        <Column gap={r.dot} style={{ width: col }}>
          <Heading>SETUP</Heading>
          <McpServers servers={mcpServers(run.setups, run.spans)} />
          <UsageRow title="SKILLS" chips={skills} />
          <NetworkHosts
            hosts={hosts(run.requests.filter((q) => q.agentId === id))}
          />
        </Column>
      </Row>
    </Column>
  );
};
