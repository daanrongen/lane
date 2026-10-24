import { contextUsed } from "@/domain/context.ts";
import type { Lane } from "@/domain/timeline.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { modelName, tokens } from "@/ui/lib/format.ts";

// Name over "model · context", as in the reference timeline.
export const LaneLabel = ({ lane, color }: { lane: Lane; color: string }) => {
  const r = useMetrics();
  const detail = [
    lane.model ? modelName(lane.model) : undefined,
    lane.lastTurn ? tokens(contextUsed(lane.lastTurn.usage)) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Row
      gap={r.dot}
      style={{
        height: r.rowHeight,
        paddingLeft: Math.round(lane.depth * r.dot * 1.5),
        overflow: "hidden",
      }}
    >
      <Dot color={color} faded={lane.finished} />
      <Column>
        <Text>{lane.agent.name}</Text>
        {detail ? (
          <Text size="small" tone="dim">
            {detail}
          </Text>
        ) : null}
      </Column>
    </Row>
  );
};
