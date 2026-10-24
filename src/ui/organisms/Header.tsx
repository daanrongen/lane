import type { Timeline } from "@/domain/timeline.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { duration, plural, tokens } from "@/ui/lib/format.ts";
import type { RunStatus } from "@/ui/lib/ports.ts";
import { Summary } from "@/ui/molecules/Summary.tsx";

const STATUS: Record<RunStatus, string> = {
  reading: "following",
  ended: "ended",
  failed: "unreadable",
};

export const Header = ({
  title,
  subtitle,
  harness,
  status,
  timeline,
}: {
  title: string;
  subtitle?: string;
  harness: string;
  status: RunStatus;
  timeline: Timeline;
}) => {
  const r = useMetrics();
  return (
    <Column gap={Math.round(r.pad / 4)}>
      <Row gap={r.pad} style={{ overflow: "hidden" }}>
        <Text size="title">{title}</Text>
        {subtitle ? (
          <Text size="small" tone="dim">
            {subtitle}
          </Text>
        ) : null}
      </Row>
      <Summary
        items={[
          harness,
          STATUS[status],
          plural(timeline.lanes.length, "agent"),
          duration(timeline.duration),
          `${tokens(timeline.usage.output)} tokens out`,
        ]}
      />
    </Column>
  );
};
