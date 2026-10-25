import { describe, expect, test } from "bun:test";
import { demoCodexEvents, demoEvents } from "@/app/demo.ts";
import { contextGauge } from "@/domain/context.ts";
import { foldAll } from "@/domain/fold.ts";
import { ThreadId } from "@/domain/ids.ts";
import { emptyRun } from "@/domain/run.ts";
import { isFailed, timeline } from "@/domain/timeline.ts";

describe("demo run", () => {
  const tl = timeline(foldAll(emptyRun(ThreadId("d"), 0), demoEvents), 0);

  test("has an orchestrator and four sub-agents, all handed back", () => {
    expect(tl.lanes.map((l) => l.depth)).toEqual([0, 1, 1, 1, 1]);
    expect(tl.links).toHaveLength(4);
    expect(tl.links.every((l) => l.returnedAt !== undefined)).toBe(true);
  });

  test("contains a failed tool call and no open spans", () => {
    const bars = tl.lanes.flatMap((l) => l.bars);
    expect(bars.some(isFailed)).toBe(true);
    expect(bars.every((b) => !b.open)).toBe(true);
  });

  test("parallel spawns share one merged waiting bar on the orchestrator", () => {
    const waits = tl.lanes[0]?.bars.filter((b) => b.kind === "Waiting");
    expect(waits?.map((b) => [b.start, b.end, b.spans.length])).toEqual([
      [2, 14.5, 3],
      [16.5, 23, 1],
    ]);
  });

  test("sub-agents are finished, the orchestrator is not", () => {
    expect(tl.lanes.map((l) => l.finished)).toEqual([
      false,
      true,
      true,
      true,
      true,
    ]);
  });

  test("every lane has a model, and a gauge can be derived", () => {
    expect(tl.lanes.every((l) => l.model)).toBe(true);
    const last = tl.lanes[0]?.lastTurn?.usage;
    expect(last && contextGauge(last, 200_000).ratio).toBeGreaterThan(0);
  });
});

describe("demo codex run", () => {
  const tl = timeline(foldAll(emptyRun(ThreadId("c"), 0), demoCodexEvents), 0);

  test("is a single finished agent with a failed call and a known window", () => {
    expect(tl.lanes).toHaveLength(1);
    expect(tl.lanes[0]?.finished).toBe(true);
    expect(tl.lanes[0]?.bars.some(isFailed)).toBe(true);
    expect(tl.lanes[0]?.lastTurn?.window).toBe(258_400);
  });
});
