import type { HostSummary } from "@/domain/network.ts";
import { Text } from "@/ui/atoms/Text.tsx";
import { hostCard } from "@/ui/lib/cards.ts";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

export const HostChip = ({ host }: { host: HostSummary }) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Hover
      card={() => hostCard(host)}
      accent={theme.text}
      style={{ flexDirection: "row", alignItems: "center", gap: r.dot / 2 }}
    >
      <Text size="small">{host.host}</Text>
      <Text size="small" tone="dim">
        {`×${host.count}`}
      </Text>
    </Hover>
  );
};
