import { Row } from "@/ui/atoms/Box.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { LegendItem } from "@/ui/molecules/LegendItem.tsx";

export const Legend = () => {
  const r = useMetrics();
  return (
    <Row gap={r.pad}>
      <LegendItem kind="Thinking" label="thinking" />
      <LegendItem kind="ToolCall" label="tool call" />
      <LegendItem kind="McpCall" label="mcp call" />
      <LegendItem kind="Waiting" label="waiting" />
      <LegendItem kind="ToolCall" failed label="failed" />
    </Row>
  );
};
