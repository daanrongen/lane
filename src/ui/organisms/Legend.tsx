import { Row } from "@/ui/atoms/Box.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { MODE_KEY } from "@/ui/lib/look.ts";
import { LegendItem } from "@/ui/molecules/LegendItem.tsx";
import { LegendMode } from "@/ui/molecules/LegendMode.tsx";
import { LegendRing } from "@/ui/molecules/LegendRing.tsx";

export const Legend = () => {
  const r = useMetrics();
  return (
    <Row gap={r.pad} style={{ flexWrap: "wrap" }}>
      <LegendItem kind="Thinking" label="thinking" />
      <LegendItem kind="ToolCall" label="tool call" />
      <LegendItem kind="McpCall" label="mcp call" />
      <LegendItem kind="Waiting" label="waiting" />
      <LegendItem kind="ToolCall" failed label="failed" />
      <LegendRing label="request" />
      {MODE_KEY.map(([label, value]) => (
        <LegendMode key={label} label={label} value={value} />
      ))}
    </Row>
  );
};
