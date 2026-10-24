import { Column } from "@/ui/atoms/Box.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import type { LaneRow } from "@/ui/lib/layout.ts";
import { laneColor } from "@/ui/lib/theme.ts";
import { LaneLabel } from "@/ui/molecules/LaneLabel.tsx";

export const LaneLabels = ({ rows }: { rows: readonly LaneRow[] }) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Column style={{ width: r.labels, flexShrink: 0, paddingRight: r.dot }}>
      {rows.map((row, i) => (
        <LaneLabel
          key={row.lane.agent.id}
          lane={row.lane}
          color={laneColor(theme, i)}
        />
      ))}
    </Column>
  );
};
