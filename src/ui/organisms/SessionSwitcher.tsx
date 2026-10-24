import type { Session } from "@/domain/session.ts";
import { Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";

// One line for compact panes; `j`/`k` still switch.
export const SessionSwitcher = ({
  sessions,
  selected,
}: {
  sessions: readonly Session[];
  selected: number;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const current = sessions[selected];
  if (!current) return null;
  return (
    <Row gap={r.dot}>
      <Dot color={current.status === "busy" ? theme.running : theme.dim} />
      <Text size="small" tone="dim">
        {`${selected + 1}/${sessions.length}  ${current.cwd}`}
      </Text>
    </Row>
  );
};
