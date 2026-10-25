import { useMemo } from "react";
import type { ContextMap as Breakdown } from "@/domain/context.ts";
import { Box, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { tokens } from "@/ui/lib/format.ts";
import { alpha } from "@/ui/lib/theme.ts";
import { tiles } from "@/ui/lib/treemap.ts";
import { ContextTile } from "@/ui/molecules/ContextTile.tsx";

// What fills an agent's context window, as in the reference's context map.
export const ContextMap = ({
  map,
  agent,
  width,
}: {
  map: Breakdown;
  agent: string;
  width: number;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const gap = Math.max(2, Math.round(r.dot / 3));
  const laid = useMemo(
    () => tiles(map.cells, width, r.contextHeight, gap),
    [map.cells, width, r.contextHeight, gap],
  );
  const percent = Math.round((map.used / map.window) * 100);

  return (
    <Box style={{ flexDirection: "column", gap: Math.round(r.pad / 2) }}>
      <Row justify="space-between">
        <Row gap={r.dot}>
          <Text>Context</Text>
          <Text tone="dim">{agent}</Text>
        </Row>
        <Row gap={r.dot}>
          <Text>{tokens(map.used)}</Text>
          <Text tone="dim">{`/ ${tokens(map.window)}`}</Text>
          <Text
            size="small"
            tone="dim"
            style={{ color: alpha(theme.text, 0.8) }}
          >
            {`${percent}%`}
          </Text>
        </Row>
      </Row>
      <Box style={{ position: "relative", width, height: r.contextHeight }}>
        {laid.map((tile) => (
          <ContextTile
            key={`${tile.cell.kind}:${tile.cell.label}`}
            tile={tile}
            map={map}
          />
        ))}
      </Box>
    </Box>
  );
};
