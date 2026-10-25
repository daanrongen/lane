import type { Thread } from "@/domain/thread.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Tag } from "@/ui/atoms/Tag.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { ago, untitled } from "@/ui/lib/format.ts";
import { harnessColor } from "@/ui/lib/look.ts";
import { alpha } from "@/ui/lib/theme.ts";

export const SessionRow = ({
  session,
  selected,
  now,
}: {
  session: Thread;
  selected: boolean;
  now: number;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const live = session.status !== "past";
  return (
    <Row
      gap={r.dot}
      style={{
        padding: Math.round(r.pad / 2),
        borderRadius: 4,
        backgroundColor: selected ? alpha(theme.text, 0.1) : undefined,
      }}
    >
      <Dot
        color={session.status === "busy" ? theme.running : theme.dim}
        faded={!live}
      />
      <Column style={{ overflow: "hidden", minWidth: 0 }}>
        <Text tone={live || selected ? "text" : "dim"}>
          {untitled(session)}
        </Text>
        <Row gap={r.dot / 2} style={{ overflow: "hidden" }}>
          <Tag color={harnessColor(session.harness, theme)}>
            {session.harness}
          </Tag>
          <Text size="small" tone="dim">
            {live ? session.status : ago(now - session.updatedAt)}
          </Text>
        </Row>
      </Column>
    </Row>
  );
};
