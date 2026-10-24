import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import type { Cell } from "@/domain/context.ts";

export interface Tile {
  readonly cell: Cell;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Node {
  cell?: Cell;
  children?: Node[];
}

const sum = (cells: readonly Cell[]) => cells.reduce((n, c) => n + c.tokens, 0);

const MIN_SHARE = 0.3;

// What is used is squarified on the left; the free window is one block on the right.
export const tiles = (
  cells: readonly Cell[],
  width: number,
  height: number,
  gap: number,
): Tile[] => {
  const used = cells.filter((c) => c.kind !== "Free");
  const free = cells.filter((c) => c.kind === "Free");
  // A small context would shrink to a sliver, so it keeps a minimum share.
  const share = sum(used) / (sum(cells) || 1);
  const usedWidth = share ? Math.round(width * Math.max(share, MIN_SHARE)) : 0;

  const root = hierarchy<Node>({ children: used.map((cell) => ({ cell })) })
    .sum((n) => n.cell?.tokens ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const placed = treemap<Node>()
    .tile(treemapSquarify)
    .size([usedWidth, height])
    .paddingInner(gap)
    .round(true)(root);

  // d3 can overshoot on slivers; clamp, and drop what is too small to see.
  const left = placed.leaves().flatMap((n) => {
    const x1 = Math.min(n.x1, usedWidth);
    const y1 = Math.min(n.y1, height);
    return n.data.cell && x1 - n.x0 >= 3 && y1 - n.y0 >= 3
      ? [
          {
            cell: n.data.cell,
            x: n.x0,
            y: n.y0,
            width: x1 - n.x0,
            height: y1 - n.y0,
          },
        ]
      : [];
  });
  const x = usedWidth + (usedWidth ? gap : 0);
  return [
    ...left,
    ...free.map((cell) => ({ cell, x, y: 0, width: width - x, height })),
  ];
};
