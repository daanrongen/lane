import { useMemo } from "react";
import { Box } from "@/ui/atoms/Box.tsx";
import { Rule } from "@/ui/atoms/Rule.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import type { Frame } from "@/ui/lib/layout.ts";
import { alpha, laneColor } from "@/ui/lib/theme.ts";
import { Bar } from "@/ui/molecules/Bar.tsx";

export const TimelinePlot = ({ frame }: { frame: Frame }) => {
  const r = useMetrics();
  const theme = useTheme();
  const names = useMemo(
    () => new Map(frame.rows.map((r) => [r.lane.agent.id, r.lane.agent.name])),
    [frame.rows],
  );
  return (
    <Box
      style={{
        position: "relative",
        width: r.plotWidth,
        height: frame.height,
        flexShrink: 0,
      }}
    >
      {frame.gridlines.map((x) => (
        <Rule
          key={`grid:${x}`}
          box={{ x, y: 0, width: 1, height: frame.height }}
          color={alpha(theme.line, 0.6)}
        />
      ))}
      {frame.gaps.map((box) => (
        <Rule key={`gap:${box.x}`} box={box} color={alpha(theme.dim, 0.18)} />
      ))}
      {frame.rows.flatMap((row, i) =>
        row.bars.map((box) => (
          <Bar
            key={`${row.lane.agent.id}:${box.bar.spans[0]?.id}`}
            box={box}
            color={laneColor(theme, i)}
            names={names}
          />
        )),
      )}
      {frame.links.flatMap((link) => {
        const color = laneColor(theme, link.row);
        return [
          ...link.lines.map((box, k) => (
            <Rule
              key={`${link.link.to}:line:${k}`}
              box={box}
              color={alpha(color, 0.8)}
            />
          )),
          ...link.dots.map((box, k) => (
            <Rule
              key={`${link.link.to}:dot:${k}`}
              box={box}
              color={color}
              round
            />
          )),
        ];
      })}
    </Box>
  );
};
