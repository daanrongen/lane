import type { ContextMap } from "@/domain/context.ts";
import { Column } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { tileCard } from "@/ui/lib/cards.ts";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { tokens } from "@/ui/lib/format.ts";
import { cellLook } from "@/ui/lib/look.ts";
import type { Tile } from "@/ui/lib/treemap.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

// A treemap cell: name over size, shown only as far as it fits.
export const ContextTile = ({ tile, map }: { tile: Tile; map: ContextMap }) => {
  const r = useMetrics();
  const theme = useTheme();
  const { color, style } = cellLook(tile.cell.kind, theme);
  const pad = Math.round(r.dot);
  // A box can never be smaller than its padding, so only tiles with room pad.
  const fitsName =
    tile.width > pad * 8 && tile.height > pad * 2 + r.font.small * 1.8;
  const fitsSize =
    tile.height > pad * 2 + r.font.small * 1.8 + r.font.small * 1.8;

  return (
    <Hover
      card={() => tileCard(tile.cell, map)}
      accent={color}
      box={{
        position: "absolute",
        left: tile.x,
        top: tile.y,
        width: tile.width,
        height: tile.height,
      }}
      style={{
        height: "100%",
        borderRadius: Math.min(6, Math.round(pad * 0.75)),
        padding: fitsName ? pad : 0,
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
    </Hover>
  );
};
