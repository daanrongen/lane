import { describe, expect, test } from "bun:test";
import { responsive } from "@/ui/lib/responsive.ts";

describe("responsive", () => {
  test("a wide pane keeps the sidebar and fills the height with rows", () => {
    const r = responsive({ width: 1400, height: 900 }, 5);
    expect(r.compact).toBe(false);
    expect(r.sidebar).toBeGreaterThanOrEqual(180);
    expect(r.rowHeight).toBeGreaterThan(36);
    expect(r.barHeight).toBe(Math.round(r.rowHeight * 0.5));
  });

  test("a narrow pane goes compact and gives the sidebar width to the plot", () => {
    const wide = responsive({ width: 900, height: 700 }, 5);
    const narrow = responsive({ width: 700, height: 700 }, 5);
    expect(narrow.compact).toBe(true);
    expect(narrow.sidebar).toBe(0);
    expect(narrow.plotWidth).toBeGreaterThan(wide.plotWidth - 200);
  });

  test("text does not shrink in small panes but grows in large ones", () => {
    const small = responsive({ width: 500, height: 400 }, 3);
    const big = responsive({ width: 2200, height: 1400 }, 3);
    expect(small.font.body).toBe(13);
    expect(big.font.body).toBeGreaterThan(small.font.body);
  });

  test("many lanes keep a readable minimum row height", () => {
    const r = responsive({ width: 1200, height: 600 }, 40);
    expect(r.rowHeight).toBe(36);
  });

  test("a single lane does not stretch past the maximum", () => {
    const r = responsive({ width: 1200, height: 1200 }, 1);
    expect(r.rowHeight).toBe(Math.round(52 * r.unit));
  });

  test("zoom scales fonts and metrics together", () => {
    const base = responsive({ width: 1200, height: 800 }, 5, 1);
    const zoomed = responsive({ width: 1200, height: 800 }, 5, 1.5);
    expect(zoomed.font.body).toBeGreaterThan(base.font.body);
    expect(zoomed.labels).toBeGreaterThan(base.labels);
  });

  test("the plot never collapses below a usable width", () => {
    expect(responsive({ width: 200, height: 400 }, 3).plotWidth).toBe(160);
  });
});
