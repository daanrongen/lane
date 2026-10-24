import { modelSpanCard } from "@/ui/lib/cards.ts";
import { useTheme } from "@/ui/lib/context.ts";
import type { ModelBox } from "@/ui/lib/layout.ts";
import { providerColor } from "@/ui/lib/look.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

// A thin strip under a lane's bars: tinted by who served the model.
export const ModelRibbon = ({ box, lane }: { box: ModelBox; lane: string }) => {
  const theme = useTheme();
  const color = providerColor(box.span.provider, theme);
  return (
    <Hover
      card={() => modelSpanCard(box.span, lane)}
      accent={color}
      box={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
      }}
      style={{ height: "100%", borderRadius: 1, backgroundColor: color }}
    />
  );
};
