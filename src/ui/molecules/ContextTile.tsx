import { Column } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { tokens } from "@/ui/lib/format.ts";
import { cellLook } from "@/ui/lib/look.ts";
import type { Tile } from "@/ui/lib/treemap.ts";

// A treemap cell: name over size, shown only as far as it fits.
export const ContextTile = ({ tile }: { tile: Tile }) => {
  const r = useMetrics();
  const theme = useTheme();
  const { color, style } = cellLook(tile.cell.kind, theme);
  const pad = Math.round(r.dot);
  const fitsName = tile.width > pad * 7 && tile.height > r.font.small * 2;
  const fitsSize = tile.height > r.font.body + r.font.small * 2.4;

  return (
    <div
      style={{
        position: "absolute",
        left: tile.x,
        top: tile.y,
        width: tile.width,
        height: tile.height,
        borderRadius: Math.min(6, Math.round(pad * 0.75)),
        padding: pad,
        overflow: "hidden",
        ...style,
      }}
    >
      {fitsName ? (
        <Column>
          <Text size="small" style={{ color }}>
            {tile.cell.label}
          </Text>
          {fitsSize ? (
            <Text size="small" tone="dim">
              {tokens(Math.round(tile.cell.tokens))}
            </Text>
          ) : null}
        </Column>
      ) : null}
    </div>
  );
};
