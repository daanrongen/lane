import { useMemo } from "react";
import type { RuntimeView } from "@/domain/floor.ts";
import type { AgentRef } from "@/domain/ids.ts";
import { baseName } from "@/domain/workspace.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import type { Group } from "@/ui/lib/fleet.ts";
import { bytes, duration, plural } from "@/ui/lib/format.ts";
import { ticks } from "@/ui/lib/lane.ts";
import { alpha } from "@/ui/lib/theme.ts";
import { FleetRow } from "@/ui/molecules/FleetRow.tsx";

// Every agent in a row, grouped by workspace, with its time lane on one shared axis.
export const FleetTable = ({
  groups,
  runtimes,
  now,
  span,
  width,
  selected,
  onSelect,
  notes,
}: {
  groups: readonly Group[];
  runtimes: readonly RuntimeView[];
  now: number;
  span: number;
  width: number;
  selected?: AgentRef;
  onSelect: (ref: AgentRef) => void;
  // Why an agent needs attention, shown when it has nothing open.
  notes: ReadonlyMap<AgentRef, string>;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const facts = Math.round(width * 0.58);
  const cols = { facts, lane: width - facts, span };
  const grid = useMemo(() => ticks(span, cols.lane), [span, cols.lane]);
  return (
    <Column style={{ width, flexShrink: 0 }}>
      <Row style={{ height: r.row, flexShrink: 0 }}>
        <Text
          size="small"
          tone="dim"
          style={{ width: facts, paddingLeft: r.dot }}
        >
          AGENTS
        </Text>
        <Row style={{ position: "relative", width: cols.lane, height: "100%" }}>
          {grid
            .filter((t) => t.x < cols.lane - r.charWidth * 16)
            .map((t) => (
              <Text
                key={t.x}
                size="small"
                tone="dim"
                style={{ position: "absolute", left: t.x + 3, top: 0 }}
              >
                {t.label}
              </Text>
            ))}
          <Text
            size="small"
            tone="dim"
            style={{ position: "absolute", right: 0, top: 0 }}
          >
            {`now · ${duration(span)}`}
          </Text>
        </Row>
      </Row>
      {groups.map((g) => (
        <Column key={g.workspace.root}>
          <Row
            gap={r.dot}
            style={{
              height: r.row,
              flexShrink: 0,
              paddingLeft: r.dot,
              backgroundColor: alpha(theme.text, 0.04),
            }}
          >
            <Text>{baseName(g.workspace.root)}</Text>
            <Text size="small" tone="dim">
              {[g.workspace.branch, plural(g.agents.length, "agent")]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </Row>
          {g.agents.map((a) => (
            <FleetRow
              key={a.ref}
              agent={a}
              now={now}
              cols={cols}
              grid={grid}
              selected={a.ref === selected}
              note={notes.get(a.ref)}
              onSelect={() => onSelect(a.ref)}
            />
          ))}
        </Column>
      ))}
      {groups.length === 0 ? (
        <Text tone="dim" style={{ padding: r.dot }}>
          nothing is running: start Claude Code, Codex or another agent
        </Text>
      ) : null}
      {runtimes.map((rt) => (
        <Column key={rt.id}>
          <Row
            gap={r.dot}
            style={{
              height: r.row,
              paddingLeft: r.dot,
              backgroundColor: alpha(theme.text, 0.04),
            }}
          >
            <Text>{rt.name}</Text>
            <Text size="small" tone="dim">
              {`runtime · used by ${plural(rt.usedBy.length, "agent")}`}
            </Text>
          </Row>
          {rt.models.map((m) => (
            <Row
              key={m.name}
              gap={r.dot}
              style={{ height: r.row, paddingLeft: r.dot * 3 }}
            >
              <Text size="small">{m.name}</Text>
              <Text size="small" tone="dim">
                {[
                  bytes(m.vram ?? m.bytes),
                  m.expiresAt &&
                    `unloads in ${duration((m.expiresAt - now) / 1000)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Row>
          ))}
        </Column>
      ))}
    </Column>
  );
};
