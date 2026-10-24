import { Box, Column, Row } from "@/ui/atoms/Box.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import type { Frame } from "@/ui/lib/layout.ts";
import { PlotLabel } from "@/ui/molecules/PlotLabel.tsx";
import { LaneLabels } from "@/ui/organisms/LaneLabels.tsx";
import { TimelinePlot } from "@/ui/organisms/TimelinePlot.tsx";

// Lane labels on the left, the plot on the right, the time axis underneath.
export const TimelineChart = ({ frame }: { frame: Frame }) => {
  const r = useMetrics();
  return (
    <Column gap={Math.round(r.pad / 3)}>
      <Row align="flex-start">
        <LaneLabels rows={frame.rows} />
        <TimelinePlot frame={frame} />
      </Row>
      <Row align="flex-start">
        <Box style={{ width: r.labels, flexShrink: 0 }} />
        <Box
          style={{
            position: "relative",
            width: r.plotWidth,
            height: r.font.small + 4,
          }}
        >
          {frame.labels.map((label) => (
            <PlotLabel key={`${label.kind}:${label.x}`} label={label} />
          ))}
        </Box>
      </Row>
    </Column>
  );
};
