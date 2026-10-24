import type { Session } from "@/domain/session.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { sessionTitle } from "@/ui/lib/format.ts";
import { alpha } from "@/ui/lib/theme.ts";

export const SessionRow = ({
  session,
  selected,
}: {
  session: Session;
  selected: boolean;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Row
      gap={r.dot}
      style={{
        padding: Math.round(r.pad / 2),
        borderRadius: 4,
        backgroundColor: selected ? alpha(theme.text, 0.1) : undefined,
      }}
    >
      <Dot color={session.status === "busy" ? theme.running : theme.dim} />
      <Column style={{ overflow: "hidden", minWidth: 0 }}>
        <Text>{sessionTitle(session)}</Text>
        <Text size="small" tone="dim">
          {session.cwd}
        </Text>
      </Column>
    </Row>
  );
};
