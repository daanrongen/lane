import { Text } from "@/ui/atoms/Text.tsx";
import { postureCard } from "@/ui/lib/cards.ts";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import type { PostureBox } from "@/ui/lib/layout.ts";
import { modeColor } from "@/ui/lib/look.ts";
import { alpha } from "@/ui/lib/theme.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

// One stretch of the mode band; the name shows when it fits.
export const PostureSegment = ({ box }: { box: PostureBox }) => {
  const r = useMetrics();
  const theme = useTheme();
  const color = modeColor(box.span.value, theme);
  const fits = box.width > box.span.value.length * r.charWidth + r.dot * 2;
  return (
    <Hover
      card={() => postureCard(box.span)}
      accent={color}
      box={{
        position: "absolute",
        left: box.x,
        top: 0,
        width: box.width,
        height: "100%",
      }}
      style={{
        height: "100%",
        alignItems: "center",
        paddingLeft: r.dot,
        borderRadius: 3,
        backgroundColor: alpha(color, 0.35),
        borderLeftWidth: 3,
        borderColor: color,
        overflow: "hidden",
      }}
    >
      {fits ? (
        <Text size="small" style={{ color }}>
          {box.span.value}
        </Text>
      ) : null}
    </Hover>
  );
};
