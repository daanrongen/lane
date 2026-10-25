import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";

const KEYS: readonly (readonly [string, string])[] = [
  ["up / down", "select the previous or next agent"],
  ["n / N", "jump to the next or previous agent that needs attention"],
  [
    "/",
    "find an agent, or a file, host, MCP server, skill or model to filter the feed",
  ],
  ["t", "show only files several agents touched"],
  ["+ / -", "zoom the time lanes"],
  ["esc", "clear the feed filter, then the selection"],
  ["?", "show or hide this help"],
  ["q", "quit"],
];

export const Help = ({ width }: { width: number }) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Column
      gap={Math.round(r.dot / 2)}
      style={{
        position: "absolute",
        top: r.pad * 3,
        left: r.pad * 2,
        width,
        padding: r.pad,
        backgroundColor: theme.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.line,
      }}
    >
      <Text>Keys</Text>
      {KEYS.map(([key, what]) => (
        <Row key={key} gap={r.pad}>
          <Text size="small" style={{ width: r.charWidth * 10 }}>
            {key}
          </Text>
          <Text size="small" tone="dim">
            {what}
          </Text>
        </Row>
      ))}
    </Column>
  );
};
