import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";

export const ControlsBar = ({ selected }: { selected: boolean }) => {
  const r = useMetrics();
  return (
    <Text size="small" tone="dim">
      {r.compact
        ? "↑↓ agent  n attention  / find  ? help"
        : `↑↓ agent   n/N attention   / find   t shared   a all   h history   +/- time   ? help   ${selected ? "esc clear   " : ""}q quit`}
    </Text>
  );
};
