import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";

export const KeyHints = () => {
  const r = useMetrics();
  return (
    <Text size="small" tone="dim">
      {r.compact
        ? "j/k session  [/] directory  q quit"
        : "j/k session   [/] directory   h/l agent   +/- zoom   q quit"}
    </Text>
  );
};
