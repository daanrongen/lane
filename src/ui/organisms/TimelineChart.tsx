import { Box, Column, Row } from "@/ui/atoms/Box.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { useAnchoredRight } from "@/ui/lib/hooks/useAnchoredRight.ts";
import type { Frame } from "@/ui/lib/layout.ts";
import { PlotLabel } from "@/ui/molecules/PlotLabel.tsx";
import { LaneLabels } from "@/ui/organisms/LaneLabels.tsx";
import { PostureBand, PostureLabel } from "@/ui/organisms/PostureBand.tsx";
import { TimelinePlot } from "@/ui/organisms/TimelinePlot.tsx";

// Lane labels stay put on the left; the plot and its time axis scroll sideways.
export const TimelineChart = ({ frame }: { frame: Frame }) => {
  const r = useMetrics();
  const scroller = useAnchoredRight(frame.width, r.plotWidth);
  const gap = Math.round(r.pad / 3);
  const axisHeight = r.font.small + 4;
  return (
    <Row align="flex-start">
      <Column gap={gap} style={{ width: r.labels, flexShrink: 0 }}>
        {frame.posture.length ? <PostureLabel /> : null}
        <LaneLabels rows={frame.rows} />
        <Box style={{ height: axisHeight }} />
      </Column>
      <Box
        ref={scroller}
        style={{ width: r.plotWidth, flexShrink: 0, overflowX: "scroll" }}
      >
        <Column gap={gap} style={{ width: frame.width, flexShrink: 0 }}>
          {frame.posture.length ? (
            <PostureBand boxes={frame.posture} width={frame.width} />
          ) : null}
          <TimelinePlot frame={frame} />
          <Box
            style={{
              position: "relative",
              width: frame.width,
              height: axisHeight,
            }}
          >
            {frame.labels.map((label) => (
              <PlotLabel key={`${label.kind}:${label.x}`} label={label} />
            ))}
          </Box>
        </Column>
      </Box>
    </Row>
  );
};
