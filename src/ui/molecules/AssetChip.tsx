import { Text } from "@/ui/atoms/Text.tsx";
import type { Chip } from "@/ui/lib/assetRows.ts";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

export const AssetChip = ({ chip }: { chip: Chip }) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Hover
      card={() => chip.card}
      accent={theme.text}
      style={{ flexDirection: "row", alignItems: "center", gap: r.dot / 2 }}
    >
      <Text size="small">{chip.label}</Text>
      <Text size="small" tone="dim">
        {chip.detail}
      </Text>
    </Hover>
  );
};
