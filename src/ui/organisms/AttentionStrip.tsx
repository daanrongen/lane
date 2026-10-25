import { Button } from "@gpuix/react";
import type { Floor } from "@/domain/floor.ts";
import type { AgentRef } from "@/domain/ids.ts";
import { Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { duration } from "@/ui/lib/format.ts";
import { stateLook } from "@/ui/lib/look.ts";
import { alpha } from "@/ui/lib/theme.ts";

const MAX = 6;

// Who is waiting on a person, stuck or broken, and for how long; it keeps its height when empty.
export const AttentionStrip = ({
  floor,
  now,
  onSelect,
}: {
  floor: Floor;
  now: number;
  onSelect: (ref: AgentRef) => void;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const names = new Map(floor.agents.map((a) => [a.ref, a]));
  return (
    <Row gap={r.dot} style={{ height: r.row, overflow: "hidden" }}>
      {floor.attention.length === 0 ? (
        <Text tone="dim">nothing needs you</Text>
      ) : (
        floor.attention.slice(0, MAX).map((a) => {
          const agent = names.get(a.agent);
          const look = stateLook(agent?.state ?? "needs-you", theme);
          return (
            <Button
              key={`${a.agent}:${a.reason}:${a.since}`}
              onClick={() => onSelect(a.agent)}
              style={{
                display: "flex",
                flexDirection: "row",
                gap: r.dot,
                alignItems: "center",
                paddingLeft: r.dot,
                paddingRight: r.dot,
                borderRadius: 4,
                backgroundColor: alpha(look.color, 0.16),
              }}
            >
              <Text style={{ color: look.color }}>
                {`${look.glyph} ${agent?.name ?? a.agent}`}
              </Text>
              <Text size="small" tone="dim">
                {`${a.reason} ${duration((now - a.since) / 1000)}`}
              </Text>
            </Button>
          );
        })
      )}
    </Row>
  );
};
