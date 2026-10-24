import { projectName } from "@/domain/projects.ts";
import type { Session } from "@/domain/session.ts";
import { Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";

// One line for compact panes; `j`/`k` still switch.
export const SessionSwitcher = ({
  current,
  position,
  total,
}: {
  current: Session | undefined;
  position: number;
  total: number;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  if (!current) return null;
  return (
    <Row gap={r.dot}>
      <Dot color={current.status === "busy" ? theme.running : theme.dim} />
      <Text size="small" tone="dim">
        {`${position}/${total}  ${projectName(current.cwd)}`}
      </Text>
    </Row>
  );
};
