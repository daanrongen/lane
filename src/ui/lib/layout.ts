import { scaleLinear } from "d3-scale";
import type { Axis } from "@/domain/axis.ts";
import type { Handoff, Request, Span } from "@/domain/run.ts";
import {
  type Bar,
  isFailed,
  type Lane,
  type Timeline,
} from "@/domain/timeline.ts";
import { duration } from "@/ui/lib/format.ts";

export interface Metrics {
  readonly plotWidth: number;
  readonly rowHeight: number;
  readonly barHeight: number;
  readonly tickEvery: number;
  // Approximate glyph width, used to keep axis labels from overlapping.
  readonly charWidth: number;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// A box can stand for several bars too narrow to tell apart.
export interface BarBox extends Box {
  readonly bar: Bar;
  readonly spans: readonly Span[];
  readonly count: number;
}

// Requests close together share one mark.
export interface RequestMark extends Box {
  readonly requests: readonly Request[];
}

export interface LaneRow {
  readonly lane: Lane;
  readonly y: number;
  readonly bars: readonly BarBox[];
  readonly marks: readonly RequestMark[];
}

// Elbows: down from the parent at the spawn, across into the child, and back at the return.
export interface LinkBoxes {
  readonly link: Handoff;
  readonly row: number;
  readonly lines: readonly Box[];
  readonly dots: readonly Box[];
}

export interface AxisLabel {
  readonly x: number;
  readonly text: string;
  readonly kind: "tick" | "gap";
}

export interface Frame {
  readonly rows: readonly LaneRow[];
  readonly links: readonly LinkBoxes[];
  readonly gridlines: readonly number[];
  readonly gaps: readonly Box[];
  readonly labels: readonly AxisLabel[];
  readonly height: number;
}

const DOT = 6;
const MARK = 8;
const MARK_MERGE = 6;
const TINY = 3;
const JOIN = 2;
const LABEL_PAD = 8;

// A tiny bar touching a neighbour merges into it; the wider one keeps its look.
// Failed calls stay visible.
const coalesce = (boxes: readonly BarBox[]): BarBox[] => {
  const out: BarBox[] = [];
  for (const box of boxes) {
    const prev = out.at(-1);
    const touching =
      prev !== undefined &&
      box.x - (prev.x + prev.width) < JOIN &&
      (prev.width < TINY || box.width < TINY) &&
      !isFailed(prev.bar) &&
      !isFailed(box.bar);
    if (!prev || !touching) {
      out.push(box);
    } else {
      out[out.length - 1] = {
        ...prev,
        bar: prev.width >= box.width ? prev.bar : box.bar,
        spans: [...prev.spans, ...box.spans],
        width: Math.max(prev.x + prev.width, box.x + box.width) - prev.x,
        count: prev.count + box.count,
      };
    }
  }
  return out;
};

// Idle markers win over ticks; a label that would overlap a kept one, or run off the plot, is dropped.
const declutter = (
  labels: readonly AxisLabel[],
  charWidth: number,
  plotWidth: number,
): AxisLabel[] => {
  const width = (l: AxisLabel) => l.text.length * charWidth;
  const rank = (l: AxisLabel) => (l.kind === "gap" ? 0 : 1);
  const kept: AxisLabel[] = [];
  for (const l of [...labels].sort((a, b) => rank(a) - rank(b) || a.x - b.x)) {
    const fits = l.x + width(l) <= plotWidth;
    const free = kept.every(
      (k) =>
        l.x + width(l) + LABEL_PAD <= k.x || k.x + width(k) + LABEL_PAD <= l.x,
    );
    if (fits && free) kept.push(l);
  }
  return kept.sort((a, b) => a.x - b.x);
};

export const layout = (tl: Timeline, axis: Axis, m: Metrics): Frame => {
  const scale = scaleLinear()
    .domain([0, Math.max(axis.total, 1)])
    .range([0, m.plotWidth]);
  const xOf = (t: number) => scale(axis.at(t));
  const height = tl.lanes.length * m.rowHeight;
  const rowOf = new Map(tl.lanes.map((l, i) => [l.agent.id, i]));
  const centre = (row: number) => row * m.rowHeight + m.rowHeight / 2;

  const rows = tl.lanes.map((lane, i): LaneRow => {
    const y = i * m.rowHeight;
    const boxes = lane.bars.map((bar): BarBox => {
      const x = xOf(bar.start);
      return {
        bar,
        spans: bar.spans,
        count: 1,
        x,
        y: y + (m.rowHeight - m.barHeight) / 2,
        width: Math.max(1, xOf(bar.end) - x),
        height: m.barHeight,
      };
    });
    const barTop = y + (m.rowHeight - m.barHeight) / 2;
    return {
      lane,
      y,
      bars: coalesce(boxes),
      marks: marksOf(lane.requests, xOf, barTop - MARK / 2),
    };
  });

  const links = tl.links.flatMap((link): LinkBoxes[] => {
    const from = rowOf.get(link.from);
    const to = rowOf.get(link.to);
    if (from === undefined || to === undefined) return [];
    const childBars = rows[to]?.bars ?? [];
    const first = childBars[0]?.x;
    const last = childBars.at(-1);
    const parentY = centre(from);
    const childY = centre(to);
    const top = Math.min(parentY, childY);
    const drop = Math.abs(parentY - childY);
    const spawnX = xOf(link.at);
    const lines: Box[] = [{ x: spawnX, y: top, width: 1, height: drop }];
    const dots: Box[] = [dot(spawnX, parentY)];

    if (first !== undefined && first > spawnX) {
      lines.push({ x: spawnX, y: childY, width: first - spawnX, height: 1 });
    }
    if (link.returnedAt !== undefined) {
      const returnX = xOf(link.returnedAt);
      const end = last ? last.x + last.width : returnX;
      lines.push({ x: returnX, y: top, width: 1, height: drop });
      if (returnX > end)
        lines.push({ x: end, y: childY, width: returnX - end, height: 1 });
      dots.push(dot(returnX, parentY));
    }
    return [{ link, row: to, lines, dots }];
  });

  const inGap = (d: number) =>
    axis.gaps.some((g) => d >= g.at && d <= g.at + g.shown);
  const tickValues = scale
    .ticks(Math.max(2, Math.floor(m.plotWidth / m.tickEvery)))
    .filter((d) => !inGap(d));

  const gaps = axis.gaps.map(
    (g): Box => ({
      x: scale(g.at),
      y: 0,
      width: Math.max(2, scale(g.at + g.shown) - scale(g.at)),
      height,
    }),
  );

  const labels = declutter(
    [
      ...tickValues.map(
        (d): AxisLabel => ({
          x: scale(d) + 3,
          text: duration(axis.invert(d)),
          kind: "tick",
        }),
      ),
      ...axis.gaps.map(
        (g): AxisLabel => ({
          x: scale(g.at) + 4,
          text: `idle ${duration(g.end - g.start)}`,
          kind: "gap",
        }),
      ),
    ],
    m.charWidth,
    m.plotWidth,
  );

  return {
    rows,
    links,
    gridlines: tickValues.map(scale),
    gaps,
    labels,
    height,
  };
};

// Marks sit on the top edge of the lane's bars, merged where they would touch.
const marksOf = (
  requests: readonly Request[],
  xOf: (t: number) => number,
  y: number,
): RequestMark[] => {
  const out: RequestMark[] = [];
  for (const r of [...requests].sort((a, b) => a.at - b.at)) {
    const x = xOf(r.at) - MARK / 2;
    const prev = out.at(-1);
    if (prev && x - prev.x < MARK_MERGE) {
      out[out.length - 1] = { ...prev, requests: [...prev.requests, r] };
    } else {
      out.push({ x, y, width: MARK, height: MARK, requests: [r] });
    }
  }
  return out;
};

const dot = (x: number, y: number): Box => ({
  x: x - (DOT - 1) / 2,
  y: y - DOT / 2,
  width: DOT,
  height: DOT,
});
