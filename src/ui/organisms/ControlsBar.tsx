import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";

export const ControlsBar = ({ selected }: { selected: boolean }) => {
  const r = useMetrics();
  return (
    <Text size="small" tone="dim">
      {r.compact
        ? "↑↓ agent  n attention  q quit"
        : `↑↓ agent   n/N attention   +/- time   ${selected ? "esc clear   " : ""}q quit`}
    </Text>
  );
};
