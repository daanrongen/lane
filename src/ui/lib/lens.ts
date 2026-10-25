import type { FeedItem, Floor } from "@/domain/floor.ts";
import { refLabel, touching } from "@/domain/pivot.ts";
import type { Ref } from "@/domain/ref.ts";

// What the feed is narrowed to: what an act involves, and when it happened.
export type What = { readonly ref: Ref } | { readonly text: string };
export interface Lens {
  readonly what?: What;
  // Epoch ms, start inclusive.
  readonly during?: readonly [number, number];
}

export const whatName = (w: What) =>
  "ref" in w ? `${w.ref._tag.toLowerCase()} ${refLabel(w.ref)}` : `"${w.text}"`;

export const about = (floor: Floor, what: What | undefined): FeedItem[] => {
  if (!what) return [...floor.feed];
  if ("ref" in what) return touching(floor, what.ref);
  const who = new Map(floor.agents.map((a) => [a.ref, a.name]));
  const words = what.text.toLowerCase().split(/\s+/).filter(Boolean);
  return floor.feed.filter((i) => {
    const text = `${i.label} ${i.kind} ${who.get(i.agent) ?? ""}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
};

export const lensed = (floor: Floor, lens: Lens | undefined): FeedItem[] => {
  const [from, to] = lens?.during ?? [];
  return about(floor, lens?.what).filter(
    (i) => from === undefined || (i.at >= from && i.at < (to ?? from)),
  );
};

export interface Bin {
  readonly count: number;
  readonly from: number;
  readonly to: number;
}

// Acts per slice of the time the items cover, oldest first.
export const histogram = (
  items: readonly FeedItem[],
  now: number,
  buckets: number,
): Bin[] => {
  const from = Math.min(now, ...items.map((i) => i.at));
  const width = Math.max(1, now - from) / buckets;
  const bins = Array.from({ length: buckets }, (_, k) => ({
    count: 0,
    from: from + k * width,
    to: from + (k + 1) * width,
  }));
  for (const i of items) {
    const bin = bins[Math.min(buckets - 1, Math.floor((i.at - from) / width))];
    if (bin) bin.count++;
  }
  return bins;
};
