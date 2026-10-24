import { describe, expect, test } from "bun:test";
import type { Cell } from "@/domain/context.ts";
import { tiles } from "@/ui/lib/treemap.ts";

const cells: Cell[] = [
  { kind: "System", label: "System & tools", tokens: 100 },
  { kind: "File", label: "src/", tokens: 50 },
  { kind: "Message", label: "Messages", tokens: 50 },
  { kind: "Free", label: "Free", tokens: 800 },
];

describe("tiles", () => {
  const out = tiles(cells, 1000, 200, 4);
  const free = out.find((t) => t.cell.kind === "Free");

  test("free space is one block on the right; a small context keeps a minimum share", () => {
    expect(free?.x).toBeGreaterThanOrEqual(300);
    expect(free?.x).toBeLessThan(310);
    expect((free?.x ?? 0) + (free?.width ?? 0)).toBe(1000);
  });

  test("used tiles stay left of free and inside the pane", () => {
    const used = out.filter((t) => t.cell.kind !== "Free");
    expect(used).toHaveLength(3);
    for (const t of used) {
      expect(t.x + t.width).toBeLessThanOrEqual(free?.x ?? 0);
      expect(t.y + t.height).toBeLessThanOrEqual(200);
    }
  });

  test("a large context takes its real share", () => {
    const big: Cell[] = [
      { kind: "File", label: "src/", tokens: 600 },
      { kind: "Free", label: "Free", tokens: 400 },
    ];
    const f = tiles(big, 1000, 200, 4).find((t) => t.cell.kind === "Free");
    expect(f?.x).toBeGreaterThanOrEqual(600);
    expect(f?.x).toBeLessThan(610);
  });

  test("nothing used leaves only free space", () => {
    const cell: Cell = { kind: "Free", label: "Free", tokens: 10 };
    expect(tiles([cell], 300, 100, 4)).toEqual([
      { cell, x: 0, y: 0, width: 300, height: 100 },
    ]);
  });
});
