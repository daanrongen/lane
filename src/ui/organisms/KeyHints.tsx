import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";

export const KeyHints = () => {
  const r = useMetrics();
  return (
    <Text size="small" tone="dim">
      {r.compact
        ? "j/k session  h/l agent  q quit"
        : "j/k session   h/l agent   +/- zoom   0 reset   q quit"}
    </Text>
  );
};
