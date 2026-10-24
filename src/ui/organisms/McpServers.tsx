import type { McpServer } from "@/domain/mcp.ts";
import { Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { McpChip } from "@/ui/molecules/McpChip.tsx";

export const McpServers = ({ servers }: { servers: readonly McpServer[] }) => {
  const r = useMetrics();
  return (
    <Row gap={r.pad} style={{ overflow: "hidden" }}>
      <Text size="small" tone="dim">
        MCP
      </Text>
      {servers.length ? (
        servers.map((s) => <McpChip key={s.name} server={s} />)
      ) : (
        <Text size="small" tone="dim">
          none
        </Text>
      )}
    </Row>
  );
};
