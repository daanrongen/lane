import { describe, expect, test } from "bun:test";
import { makeAxis } from "@/domain/axis.ts";
import { AgentId, SessionId, SpanId } from "@/domain/ids.ts";
import { emptyRun, type Run, type Span } from "@/domain/run.ts";
import { timeline } from "@/domain/timeline.ts";

const opts = { maxIdle: 60, collapsedTo: 2 };

const thinking = (id: string, start: number, end: number): Span => ({
  _tag: "Thinking",
  id: SpanId(id),
  agentId: AgentId("main"),
  label: id,
  start,
  end,
});

const axisOf = (...spans: Span[]) => {
  const run: Run = {
    ...emptyRun(SessionId("s"), 0),
    agents: [{ id: AgentId("main"), parentId: null, name: "main" }],
    spans,
  };
  return makeAxis(timeline(run, 0), opts);
};

describe("makeAxis", () => {
  test("without long gaps it is the identity", () => {
    const axis = axisOf(thinking("a", 0, 10), thinking("b", 40, 50));
    expect(axis.gaps).toEqual([]);
    expect(axis.at(45)).toBe(45);
    expect(axis.total).toBe(50);
  });

  test("a long idle stretch collapses to the configured length", () => {
    const axis = axisOf(thinking("a", 0, 10), thinking("b", 3610, 3620));
    expect(axis.gaps).toEqual([{ start: 10, end: 3610, at: 10, shown: 2 }]);
    expect(axis.at(10)).toBe(10);
    expect(axis.at(1810)).toBeCloseTo(11);
    expect(axis.at(3610)).toBe(12);
    expect(axis.total).toBe(22);
  });

  test("a bar spanning the gap prevents it", () => {
    const axis = axisOf(thinking("a", 0, 5000), thinking("b", 10, 20));
    expect(axis.gaps).toEqual([]);
  });

  test("several gaps accumulate and the mapping stays monotonic", () => {
    const axis = axisOf(
      thinking("a", 0, 10),
      thinking("b", 1000, 1010),
      thinking("c", 5000, 5010),
    );
    expect(axis.gaps).toHaveLength(2);
    const samples = [0, 10, 500, 1000, 1010, 3000, 5000, 5010].map(axis.at);
    expect(samples).toEqual([...samples].sort((a, b) => a - b));
    expect(axis.total).toBeCloseTo(10 + 2 + 10 + 2 + 10);
  });

  test("invert undoes at, including inside a collapsed gap", () => {
    const axis = axisOf(thinking("a", 0, 10), thinking("b", 3610, 3620));
    for (const t of [0, 5, 10, 1810, 3610, 3615, 3620]) {
      expect(axis.invert(axis.at(t))).toBeCloseTo(t);
    }
  });

  test("an empty run has no extent", () => {
    expect(axisOf().total).toBe(0);
  });
});
