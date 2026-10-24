import type { Bar } from "@/domain/timeline.ts";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { barLook } from "@/ui/lib/look.ts";

export const Swatch = ({
  kind,
  failed = false,
}: {
  kind: Bar["kind"];
  failed?: boolean;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <div
      style={{
        width: r.dot * 2,
        height: r.dot,
        borderRadius: 3,
        ...barLook(kind, failed, theme.text, theme),
      }}
    />
  );
};
