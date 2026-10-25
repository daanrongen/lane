import { Button } from "@gpuix/react";
import type { AgentView } from "@/domain/floor.ts";
import { Box, Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { duration } from "@/ui/lib/format.ts";
import { place, type Tick } from "@/ui/lib/lane.ts";
import {
  harnessColor,
  INSIGHT_GLYPH,
  laneLook,
  stateLook,
} from "@/ui/lib/look.ts";
import { alpha } from "@/ui/lib/theme.ts";

export interface FleetColumns {
  readonly facts: number;
  readonly lane: number;
  readonly span: number;
}

const FillBar = ({ ratio, width }: { ratio: number | null; width: number }) => {
  const theme = useTheme();
  if (ratio === null) {
    return (
      <Text size="small" tone="dim" style={{ width }}>
        n/a
      </Text>
    );
  }
  return (
    <Box
      style={{
        width,
        height: 5,
        flexShrink: 0,
        backgroundColor: alpha(theme.dim, 0.25),
      }}
    >
      <div
        style={{
          width: Math.round(width * ratio),
          height: 5,
          backgroundColor: ratio >= 0.9 ? theme.failed : theme.dim,
        }}
      />
    </Box>
  );
};

// One agent: its facts, then its own lane on the shared time axis.
export const FleetRow = ({
  agent,
  now,
  cols,
  grid,
  selected,
  note,
  onSelect,
}: {
  agent: AgentView;
  now: number;
  cols: FleetColumns;
  grid: readonly Tick[];
  selected: boolean;
  note?: string;
  onSelect: () => void;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const state = stateLook(agent.state, theme);
  const color = harnessColor(agent.harness, theme);
  const unit = r.charWidth * 6;
  const quiet = agent.lastEventAt
    ? duration((now - agent.lastEventAt) / 1000)
    : "";
  const what = agent.now?.label ?? note ?? agent.state;
  return (
    <Row
      style={{
        height: r.row,
        flexShrink: 0,
        backgroundColor: selected ? alpha(theme.text, 0.1) : undefined,
      }}
    >
      <Button
        onClick={onSelect}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: r.dot,
          width: cols.facts,
          height: "100%",
          flexShrink: 0,
          overflow: "hidden",
          paddingLeft: r.dot + agent.depth * r.dot * 2,
        }}
      >
        <Text style={{ color: state.color, width: r.dot * 1.5 }}>
          {state.glyph}
        </Text>
        <Dot color={color} />
        <Text style={{ width: unit * 3.2 - agent.depth * r.dot * 2 }}>
          {agent.name}
        </Text>
        <Text size="small" tone="dim" style={{ flexGrow: 1, minWidth: 0 }}>
          {what}
        </Text>
        <Text size="small" tone="dim" style={{ width: unit * 0.9 }}>
          {quiet}
        </Text>
        <FillBar ratio={agent.fill?.ratio ?? null} width={unit * 1.2} />
        <Text size="small" style={{ width: unit * 1.3, color: theme.failed }}>
          {agent.insights.map((i) => INSIGHT_GLYPH[i]).join(" ")}
        </Text>
      </Button>
      <Box
        style={{
          position: "relative",
          width: cols.lane,
          height: "100%",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {grid.map((t) => (
          <div
            key={t.x}
            style={{
              position: "absolute",
              left: t.x,
              top: 0,
              width: 1,
              height: "100%",
              backgroundColor: alpha(theme.line, 0.6),
            }}
          />
        ))}
        {agent.lane.map((bar) => {
          const at = place(bar, now, cols.span, cols.lane);
          if (!at) return null;
          return (
            <div
              key={`${bar.start}:${bar.kind}`}
              style={{
                position: "absolute",
                left: at.x,
                top: Math.round(r.row * 0.25),
                width: at.width,
                height: Math.round(r.row * 0.5),
                borderRadius: 3,
                ...laneLook(bar, color, theme),
              }}
            />
          );
        })}
      </Box>
    </Row>
  );
};
