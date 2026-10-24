import { Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import type { Chip } from "@/ui/lib/usageRows.ts";
import { UsageChip } from "@/ui/molecules/UsageChip.tsx";

// A titled line of chips: the skills or models a session actually used.
export const UsageRow = ({
  title,
  chips,
}: {
  title: string;
  chips: readonly Chip[];
}) => {
  const r = useMetrics();
  return (
    <Row gap={r.pad} style={{ overflow: "hidden" }}>
      <Text size="small" tone="dim">
        {title}
      </Text>
      {chips.map((chip) => (
        <UsageChip key={chip.label} chip={chip} />
      ))}
    </Row>
  );
};
