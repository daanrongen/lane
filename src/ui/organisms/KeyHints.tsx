import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";

export const KeyHints = () => {
  const r = useMetrics();
  return (
    <Text size="small" tone="dim">
      {r.compact
        ? "j/k session  [/] project  q quit"
        : "j/k session   [/] project   h/l agent   +/- zoom   q quit"}
    </Text>
  );
};
