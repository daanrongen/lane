import { contextUsed, laneWindow } from "@/domain/context.ts";
import type { Lane } from "@/domain/timeline.ts";
import { Column } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { laneCard } from "@/ui/lib/cards.ts";
import { useMetrics } from "@/ui/lib/context.ts";
import { modelName, tokens } from "@/ui/lib/format.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

// Name over "model · context", as in the reference timeline.
export const LaneLabel = ({ lane, color }: { lane: Lane; color: string }) => {
  const r = useMetrics();
  const used = lane.lastTurn ? contextUsed(lane.lastTurn.usage) : 0;
  const detail = [
    lane.model ? modelName(lane.model) : undefined,
    lane.lastTurn ? tokens(used) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Hover
      card={() => laneCard(lane, used, laneWindow(lane))}
      accent={color}
      box={{ height: r.rowHeight }}
      style={{
        height: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: r.dot,
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
    </Hover>
  );
};
