import { Text } from "@/ui/atoms/Text.tsx";
import type { AxisLabel } from "@/ui/lib/layout.ts";

export const PlotLabel = ({ label }: { label: AxisLabel }) => (
  <Text
    size="small"
    tone="dim"
    style={{ position: "absolute", left: label.x, top: 0 }}
  >
    {label.text}
  </Text>
);
