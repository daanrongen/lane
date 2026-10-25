import type { FeedItem, Floor } from "@/domain/floor.ts";
import { refLabel, touching } from "@/domain/pivot.ts";
import type { Ref } from "@/domain/ref.ts";

// What the feed is narrowed to: everything that involves a ref, or acts that mention some text.
export type Lens = { readonly ref: Ref } | { readonly text: string };

export const lensName = (l: Lens) =>
  "ref" in l ? `${l.ref._tag.toLowerCase()} ${refLabel(l.ref)}` : `"${l.text}"`;

export const lensed = (floor: Floor, lens: Lens | undefined): FeedItem[] => {
  if (!lens) return [...floor.feed];
  if ("ref" in lens) return touching(floor, lens.ref);
  const who = new Map(floor.agents.map((a) => [a.ref, a.name]));
  const words = lens.text.toLowerCase().split(/\s+/).filter(Boolean);
  return floor.feed.filter((i) => {
    const text = `${i.label} ${i.kind} ${who.get(i.agent) ?? ""}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
};

// Acts per slice of the time the items cover, oldest first.
export const histogram = (
  items: readonly FeedItem[],
  now: number,
  buckets: number,
): number[] => {
  const out = new Array<number>(buckets).fill(0);
  const from = Math.min(now, ...items.map((i) => i.at));
  const width = Math.max(1, now - from) / buckets;
  for (const i of items) {
    const k = Math.min(buckets - 1, Math.floor((i.at - from) / width));
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};
