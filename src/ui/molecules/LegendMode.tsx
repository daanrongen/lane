import { Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { modeColor } from "@/ui/lib/look.ts";

export const LegendMode = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Row gap={Math.round(r.dot / 2)}>
      <Dot color={modeColor(value, theme)} />
      <Text size="small" tone="dim">
        {label}
      </Text>
    </Row>
  );
};
