import { describe, expect, test } from "bun:test";
import { responsive } from "@/ui/lib/responsive.ts";

describe("responsive", () => {
  test("a wide pane keeps the sidebar", () => {
    const r = responsive({ width: 1400, height: 900 });
    expect(r.compact).toBe(false);
    expect(r.sidebar).toBeGreaterThanOrEqual(180);
    expect(r.barHeight).toBe(Math.round(r.rowHeight * 0.5));
  });

  test("a narrow pane goes compact and gives the sidebar width to the plot", () => {
    const wide = responsive({ width: 900, height: 700 });
    const narrow = responsive({ width: 700, height: 700 });
    expect(narrow.compact).toBe(true);
    expect(narrow.sidebar).toBe(0);
    expect(narrow.plotWidth).toBeGreaterThan(wide.plotWidth - 200);
  });

  test("text does not shrink in small panes but grows in large ones", () => {
    const small = responsive({ width: 500, height: 400 });
    const big = responsive({ width: 2200, height: 1400 });
    expect(small.font.body).toBe(13);
    expect(big.font.body).toBeGreaterThan(small.font.body);
  });

  test("a short window never resizes components", () => {
    const tall = responsive({ width: 1200, height: 1000 });
    const short = responsive({ width: 1200, height: 300 });
    expect(short.rowHeight).toBe(tall.rowHeight);
    expect(short.contextHeight).toBe(tall.contextHeight);
    expect(short.pad).toBe(tall.pad);
  });

  test("zoom scales fonts and metrics together", () => {
    const base = responsive({ width: 1200, height: 800 }, 1);
    const zoomed = responsive({ width: 1200, height: 800 }, 1.5);
    expect(zoomed.font.body).toBeGreaterThan(base.font.body);
    expect(zoomed.labels).toBeGreaterThan(base.labels);
  });

  test("the plot never collapses below a usable width", () => {
    expect(responsive({ width: 200, height: 400 }).plotWidth).toBe(160);
  });
});
