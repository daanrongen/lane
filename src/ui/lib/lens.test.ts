import { describe, expect, test } from "bun:test";
import type { FeedItem, Floor } from "@/domain/floor.ts";
import { AgentRef } from "@/domain/ids.ts";
import { file } from "@/domain/ref.ts";
import { histogram, lensed } from "@/ui/lib/lens.ts";

const a = AgentRef("claude", "t", "main");
const item = (at: number, label: string, touches: FeedItem["touches"] = []) =>
  ({ at, agent: a, kind: "shell", label, status: "ok", touches }) as FeedItem;

const floor = {
  agents: [{ ref: a, name: "billing" }],
  feed: [item(30, "bun test"), item(20, "edit", [file("/x")]), item(0, "ls")],
} as unknown as Floor;

describe("lensed", () => {
  test("no lens keeps everything", () => {
    expect(lensed(floor, undefined).length).toBe(3);
  });

  test("a ref keeps what touched it", () => {
    expect(
      lensed(floor, { what: { ref: file("/x") } }).map((i) => i.label),
    ).toEqual(["edit"]);
  });

  test("text must match every word in the act or its agent", () => {
    expect(lensed(floor, { what: { text: "billing test" } }).length).toBe(1);
    expect(lensed(floor, { what: { text: "billing nope" } }).length).toBe(0);
  });
});

describe("lensed during", () => {
  test("keeps acts inside the time range", () => {
    expect(lensed(floor, { during: [10, 25] }).map((i) => i.label)).toEqual([
      "edit",
    ]);
  });
});

describe("histogram", () => {
  test("counts acts per slice from the oldest to now", () => {
    expect(histogram(floor.feed, 30, 3).map((b) => b.count)).toEqual([1, 0, 2]);
    expect(histogram([], 30, 3).map((b) => b.count)).toEqual([0, 0, 0]);
  });
});
