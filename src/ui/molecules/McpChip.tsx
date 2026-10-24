import type { McpServer } from "@/domain/mcp.ts";
import { Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { plural } from "@/ui/lib/format.ts";

// A server with what it contributed: calls once used, else its tool count.
export const McpChip = ({ server }: { server: McpServer }) => {
  const r = useMetrics();
  const theme = useTheme();
  const detail = server.calls
    ? plural(server.calls, "call")
    : plural(server.tools, "tool");
  return (
    <Row gap={Math.round(r.dot / 2)}>
      <Dot color={server.failed ? theme.failed : theme.running} />
      <Text size="small">{server.name}</Text>
      <Text size="small" tone="dim">
        {server.failed ? `${detail}, ${server.failed} failed` : detail}
      </Text>
    </Row>
  );
};
