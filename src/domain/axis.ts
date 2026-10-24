import type { Timeline } from "@/domain/timeline.ts";

export interface AxisOptions {
  // Longer stretches with no agent active collapse to `collapsedTo` seconds.
  readonly maxIdle: number;
  readonly collapsedTo: number;
}

export interface Gap {
  readonly start: number;
  readonly end: number;
  // Where the collapsed gap begins on the display axis, and how long it shows.
  readonly at: number;
  readonly shown: number;
}

export interface Axis {
  readonly total: number;
  readonly gaps: readonly Gap[];
  // Run seconds to display seconds; monotonic and piecewise linear.
  readonly at: (t: number) => number;
  // Display seconds back to run seconds.
  readonly invert: (d: number) => number;
}

const activity = (tl: Timeline): (readonly [number, number])[] =>
  [
    ...tl.lanes.flatMap((l) => l.bars.map((b) => [b.start, b.end] as const)),
    ...tl.links.map((h) => [h.at, h.returnedAt ?? h.at] as const),
  ].sort((a, b) => a[0] - b[0]);

export const makeAxis = (
  tl: Timeline,
  { maxIdle, collapsedTo }: AxisOptions,
): Axis => {
  const spans = activity(tl);
  let reach = spans[0]?.[1] ?? 0;
  let saved = 0;
  const gaps: Gap[] = [];
  for (const [start, end] of spans) {
    if (start - reach > maxIdle) {
      gaps.push({
        start: reach,
        end: start,
        at: reach - saved,
        shown: collapsedTo,
      });
      saved += start - reach - collapsedTo;
    }
    reach = Math.max(reach, end);
  }

  const at = (t: number) => {
    let shift = 0;
    for (const g of gaps) {
      if (t <= g.start) break;
      const length = g.end - g.start;
      if (t < g.end) return g.at + (t - g.start) * (collapsedTo / length);
      shift += length - collapsedTo;
    }
    return t - shift;
  };

  const invert = (d: number) => {
    let shift = 0;
    for (const g of gaps) {
      if (d <= g.at) break;
      const length = g.end - g.start;
      if (d < g.at + g.shown) return g.start + (d - g.at) * (length / g.shown);
      shift += length - g.shown;
    }
    return d + shift;
  };

  return { total: at(tl.duration), gaps, at, invert };
};
