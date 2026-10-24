import { isFailed } from "@/domain/timeline.ts";
import { useTheme } from "@/ui/lib/context.ts";
import type { BarBox } from "@/ui/lib/layout.ts";
import { barLook } from "@/ui/lib/look.ts";

// A bar on the plot, absolutely placed by the layout.
export const Pill = ({ box, color }: { box: BarBox; color: string }) => {
  const theme = useTheme();
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        borderRadius: Math.min(6, Math.round(box.height * 0.35)),
        ...barLook(box.bar.kind, isFailed(box.bar), color, theme),
      }}
    />
  );
};
