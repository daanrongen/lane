import type { AgentState } from "@/domain/agent.ts";
import type { Floor } from "@/domain/floor.ts";
import { Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { tokens } from "@/ui/lib/format.ts";
import { harnessColor, stateLook } from "@/ui/lib/look.ts";

const STATES: readonly AgentState[] = [
  "needs-you",
  "failed",
  "stalled",
  "working",
  "waiting",
  "idle",
  "done",
];

// What the whole machine is doing, always in view.
export const TopBar = ({ floor }: { floor: Floor }) => {
  const r = useMetrics();
  const theme = useTheme();
  const harnesses = new Map<string, number>();
  for (const a of floor.agents) {
    harnesses.set(a.harness, (harnesses.get(a.harness) ?? 0) + 1);
  }
  return (
    <Row gap={r.pad} style={{ overflow: "hidden" }}>
      <Text size="title">lane</Text>
      {STATES.filter((s) => floor.totals.states[s] > 0).map((s) => {
        const look = stateLook(s, theme);
        return (
          <Text key={s} style={{ color: look.color }}>
            {`${look.glyph} ${floor.totals.states[s]} ${s}`}
          </Text>
        );
      })}
      <Row gap={r.pad} style={{ flexGrow: 1, justifyContent: "flex-end" }}>
        {[...harnesses].map(([h, n]) => (
          <Text key={h} size="small" style={{ color: harnessColor(h, theme) }}>
            {`${h} ${n}`}
          </Text>
        ))}
        <Text size="small" tone="dim">
          {`${tokens(floor.totals.usage.output)} out`}
        </Text>
        <Text size="small" tone="dim">
          / search
        </Text>
      </Row>
    </Row>
  );
};
