import { Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";

export const LegendRing = ({ label }: { label: string }) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Row gap={Math.round(r.dot / 2)}>
      <div
        style={{
          width: r.dot,
          height: r.dot,
          borderRadius: r.dot / 2,
          borderWidth: 2,
          borderColor: theme.text,
        }}
      />
      <Text size="small" tone="dim">
        {label}
      </Text>
    </Row>
  );
};
