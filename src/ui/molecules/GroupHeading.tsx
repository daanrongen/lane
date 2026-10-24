import { Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { dirName, type Group } from "@/ui/lib/sessionsNav.ts";

export const GroupHeading = ({ group }: { group: Group }) => {
  const r = useMetrics();
  return (
    <Row
      gap={r.dot}
      style={{
        paddingLeft: Math.round(r.pad / 2),
        paddingTop: Math.round(r.pad / 2),
      }}
    >
      <Text size="small">{dirName(group.cwd)}</Text>
      <Text size="small" tone="dim">
        {String(group.sessions.length)}
      </Text>
    </Row>
  );
};
