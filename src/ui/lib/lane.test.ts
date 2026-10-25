import { describe, expect, test } from "bun:test";
import type { AgentView, LaneBar } from "@/domain/floor.ts";
import { AgentRef } from "@/domain/ids.ts";
import { elbows, place, ticks } from "@/ui/lib/lane.ts";

const bar = (start: number, end?: number): LaneBar => ({
  start,
  end,
  kind: "tool",
  failed: false,
  awaiting: false,
});

describe("place", () => {
  // 100 s across 1000 px, ending at 100_000: 10 px a second.
  const at = (b: LaneBar) => place(b, 100_000, 100, 1000);

  test("a bar sits where its time is", () => {
    expect(at(bar(90_000, 95_000))).toEqual({ x: 900, width: 50 });
  });

  test("an open bar runs to now, and a bar before the window is out of view", () => {
    expect(at(bar(95_000))).toEqual({ x: 950, width: 50 });
    expect(at(bar(-50_000, -10_000))).toBeUndefined();
  });

  test("a bar that began before the window is cut at its edge, and is never thinner than 2 px", () => {
    expect(at(bar(-10_000, 10_000))).toEqual({ x: 0, width: 100 });
    expect(at(bar(50_000, 50_001))?.width).toBe(2);
  });
});

describe("ticks", () => {
  test("gridlines count back from now at a round step", () => {
    expect(ticks(600, 600)).toEqual([
      { x: 480, label: "-2m00s" },
      { x: 360, label: "-4m00s" },
      { x: 240, label: "-6m00s" },
      { x: 120, label: "-8m00s" },
    ]);
  });
});

describe("elbows", () => {
  const view = (name: string, depth: number, born?: number) =>
    ({
      ref: AgentRef("claude", "t", name),
      thread: "t",
      depth,
      born,
    }) as AgentView;
  const rows = [
    view("main", 0),
    view("a", 1, 90_000),
    view("b", 1, 95_000),
    view("late", 1),
  ];
  const out = elbows(rows, 100_000, 100, 1000);
  const of = (i: number) => out.get(rows[i]?.ref as AgentRef);

  test("a sub-agent's line starts at its handoff", () => {
    expect(of(1)?.own).toBe(900);
    expect(of(2)?.own).toBe(950);
    expect(of(0)?.own).toBeUndefined();
  });

  test("lines of later sub-agents pass down through the rows above them", () => {
    expect(of(0)?.through).toEqual([900, 950]);
    expect(of(1)?.through).toEqual([950]);
    expect(of(2)?.through).toEqual([]);
  });
});
