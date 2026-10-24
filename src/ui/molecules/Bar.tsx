import { ofKind } from "@/domain/assets.ts";
import type { AgentId } from "@/domain/ids.ts";
import { isFailed } from "@/domain/timeline.ts";
import { spanCard } from "@/ui/lib/cards.ts";
import { useCatalog, useTheme } from "@/ui/lib/context.ts";
import type { BarBox } from "@/ui/lib/layout.ts";
import { barLook } from "@/ui/lib/look.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

// A bar on the plot, absolutely placed by the layout, with its details on hover.
export const Bar = ({
  box,
  color,
  names,
}: {
  box: BarBox;
  color: string;
  names: ReadonlyMap<AgentId, string>;
}) => {
  const theme = useTheme();
  const catalog = useCatalog();
  return (
    <Hover
      card={() => spanCard(box.spans, names, ofKind(catalog, "Rule"))}
      accent={color}
      box={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
      }}
      style={{
        height: "100%",
        borderRadius: Math.min(6, Math.round(box.height * 0.35)),
        ...barLook(box.bar.kind, isFailed(box.bar), color, theme),
      }}
    />
  );
};
