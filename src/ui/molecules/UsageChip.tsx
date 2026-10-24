import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import type { Chip } from "@/ui/lib/usageRows.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

// A name and a count, with the details on hover; a dot when it has a colour of its own.
export const UsageChip = ({ chip }: { chip: Chip }) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Hover
      card={() => chip.card}
      accent={chip.color ?? theme.text}
      style={{ flexDirection: "row", alignItems: "center", gap: r.dot / 2 }}
    >
      {chip.color ? <Dot color={chip.color} /> : null}
      <Text size="small">{chip.label}</Text>
      <Text size="small" tone="dim">
        {chip.detail}
      </Text>
    </Hover>
  );
};
