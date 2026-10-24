import type { Bar } from "@/domain/timeline.ts";
import { Row } from "@/ui/atoms/Box.tsx";
import { Swatch } from "@/ui/atoms/Swatch.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";

export const LegendItem = ({
  kind,
  failed,
  label,
}: {
  kind: Bar["kind"];
  failed?: boolean;
  label: string;
}) => {
  const r = useMetrics();
  return (
    <Row gap={Math.round(r.dot / 2)}>
      <Swatch kind={kind} failed={failed} />
      <Text size="small" tone="dim">
        {label}
      </Text>
    </Row>
  );
};
