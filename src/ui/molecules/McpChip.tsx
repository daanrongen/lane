import type { McpServer } from "@/domain/mcp.ts";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { serverCard } from "@/ui/lib/cards.ts";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { plural } from "@/ui/lib/format.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

// A server with what it contributed: calls once used, else its tool count.
export const McpChip = ({ server }: { server: McpServer }) => {
  const r = useMetrics();
  const theme = useTheme();
  const color = server.failed ? theme.failed : theme.running;
  const detail = server.calls
    ? plural(server.calls, "call")
    : plural(server.tools, "tool");
  return (
    <Hover
      card={() => serverCard(server)}
      accent={color}
      style={{ flexDirection: "row", alignItems: "center", gap: r.dot / 2 }}
    >
      <Dot color={color} />
      <Text size="small">{server.name}</Text>
      <Text size="small" tone="dim">
        {server.failed ? `${detail}, ${server.failed} failed` : detail}
      </Text>
    </Hover>
  );
};
