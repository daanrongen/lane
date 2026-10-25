import type { LaneBar } from "@/domain/floor.ts";
import { duration } from "@/ui/lib/format.ts";

export interface Placed {
  readonly x: number;
  readonly width: number;
}

// Where a bar sits on an axis that ends at `now` and covers `span` seconds; none if it is out of view.
export const place = (
  bar: LaneBar,
  now: number,
  span: number,
  width: number,
): Placed | undefined => {
  const from = now - span * 1000;
  const end = bar.end ?? now;
  if (end < from || bar.start > now) return undefined;
  const px = width / (span * 1000);
  const x = Math.max(0, (bar.start - from) * px);
  const right = Math.min(width, (end - from) * px);
  return { x, width: Math.max(2, right - x) };
};

const STEPS = [10, 30, 60, 120, 300, 600, 1800, 3600];

export interface Tick {
  readonly x: number;
  readonly label: string;
}

// Gridlines counting back from now.
export const ticks = (span: number, width: number): Tick[] => {
  const step = STEPS.find((s) => s >= span / 5) ?? STEPS.at(-1) ?? span;
  const out: Tick[] = [];
  for (let back = step; back < span; back += step) {
    out.push({
      x: Math.round(width - (back / span) * width),
      label: `-${duration(back)}`,
    });
  }
  return out;
};
