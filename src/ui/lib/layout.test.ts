import { describe, expect, test } from "bun:test";
import { demoEvents } from "@/adapters/memory/scenario/fixtures.ts";
import { makeAxis } from "@/domain/axis.ts";
import { foldAll } from "@/domain/fold.ts";
import { AgentId, SpanId, ThreadId } from "@/domain/ids.ts";
import { emptyRun, type Run, type Span } from "@/domain/run.ts";
import { timeline } from "@/domain/timeline.ts";
import { layout } from "@/ui/lib/layout.ts";

const m = {
  plotWidth: 1000,
  pxPerSecond: 0,
  rowHeight: 40,
  barHeight: 20,
  tickEvery: 100,
  charWidth: 7,
};
const idle = { maxIdle: 60, collapsedTo: 2 };

const frameOf = (run: Run, plotWidth = m.plotWidth, pxPerSecond = 0) => {
  const tl = timeline(run, 0);
  return layout(tl, makeAxis(tl, idle), { ...m, plotWidth, pxPerSecond });
};

const span = (
  kind: "Thinking" | "ToolCall",
  id: string,
  start: number,
  end: number,
  failed = false,
): Span =>
  kind === "Thinking"
    ? {
        _tag: "Thinking",
        id: SpanId(id),
        agentId: AgentId("main"),
        label: id,
        start,
        end,
      }
    : {
        _tag: "ToolCall",
        id: SpanId(id),
        agentId: AgentId("main"),
        label: id,
        tool: "Bash",
        failed,
        start,
        end,
      };

const thinking = (id: string, start: number, end: number) =>
  span("Thinking", id, start, end);

const single = (...spans: Span[]): Run => ({
  ...emptyRun(ThreadId("s"), 0),
  agents: [{ id: AgentId("main"), parentId: null, name: "main" }],
  spans,
});

describe("layout bars", () => {
  test("rows stack by lane and wide bars stay separate", () => {
    const f = frameOf(single(thinking("a", 0, 5), thinking("b", 5, 10)));
    expect(f.height).toBe(40);
    expect(f.rows[0]?.bars.map((b) => [b.x, b.width, b.y, b.height])).toEqual([
      [0, 500, 10, 20],
      [500, 500, 10, 20],
    ]);
  });

  test("tiny bars merge across kinds and the wider one sets the look", () => {
    const tiny = Array.from({ length: 40 }, (_, i) =>
      span(i % 2 ? "ToolCall" : "Thinking", `t${i}`, i * 0.02, i * 0.02 + 0.01),
    );
    const f = frameOf(single(...tiny, thinking("end", 40, 41)));
    const bars = f.rows[0]?.bars ?? [];
    expect(bars).toHaveLength(2);
    expect(bars.reduce((n, b) => n + b.count, 0)).toBe(41);
  });

  test("a failed call is never absorbed", () => {
    const f = frameOf(
      single(
        thinking("a", 0, 0.01),
        span("ToolCall", "bad", 0.02, 0.03, true),
        thinking("z", 40, 41),
      ),
    );
    expect(f.rows[0]?.bars).toHaveLength(3);
  });
});

describe("layout axis", () => {
  test("idle gaps get a labelled marker and ticks skip them", () => {
    const f = frameOf(single(thinking("a", 0, 10), thinking("b", 3610, 3620)));
    expect(f.gaps).toHaveLength(1);
    expect(f.gaps[0]?.height).toBe(40);
    expect(f.labels.filter((l) => l.kind === "gap").map((l) => l.text)).toEqual(
      ["idle 1h00m"],
    );
    expect(f.gridlines.length).toBeGreaterThan(1);
  });

  test("labels never overlap, even with many nearby idle gaps", () => {
    const bursts = Array.from({ length: 20 }, (_, i) =>
      thinking(`b${i}`, i * 200, i * 200 + 5),
    );
    const f = frameOf(single(...bursts));
    expect(f.gaps.length).toBe(19);
    expect(f.labels.length).toBeGreaterThan(0);
    const boxes = f.labels.map(
      (l) => [l.x, l.x + l.text.length * m.charWidth] as const,
    );
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1))
        expect(a[1] <= b[0] || b[1] <= a[0]).toBe(true);
    }
  });

  test("labels stay inside the plot", () => {
    const f = frameOf(single(thinking("a", 0, 100)), 300);
    for (const l of f.labels)
      expect(l.x + l.text.length * m.charWidth).toBeLessThanOrEqual(300);
  });
});

describe("layout scrolling", () => {
  const run = single(thinking("a", 0, 100));
  const widthOf = (f: ReturnType<typeof frameOf>) => f.rows[0]?.bars[0]?.width;

  test("a short run fills the window", () => {
    expect(frameOf(run, 300, 1).width).toBe(300);
  });

  test("a long run grows past the window at a fixed block size", () => {
    const narrow = frameOf(run, 300, 5);
    const wide = frameOf(run, 400, 5);
    expect(narrow.width).toBe(500);
    expect(widthOf(narrow)).toBe(widthOf(wide));
  });
});

describe("layout links", () => {
  const run = foldAll(emptyRun(ThreadId("d"), 0), demoEvents);
  const f = frameOf(run);

  test("every hand-off becomes an elbow into its child lane", () => {
    expect(f.rows).toHaveLength(5);
    expect(f.links.map((l) => l.row)).toEqual([1, 2, 3, 4]);
  });

  test("an elbow has a drop and an across at spawn and at return", () => {
    const first = f.links[0];
    expect(first?.lines).toHaveLength(4);
    expect(first?.lines[0]?.height).toBe(40);
    expect(first?.lines[0]?.width).toBe(1);
    expect(first?.lines[1]?.height).toBe(1);
    expect(first?.dots).toHaveLength(2);
  });

  test("the spawn elbow runs into the child's first bar", () => {
    const link = f.links[0];
    const child = f.rows[link?.row ?? 0]?.bars[0];
    const across = link?.lines[1];
    expect((across?.x ?? 0) + (across?.width ?? 0)).toBeCloseTo(child?.x ?? -1);
  });
});

describe("layout request marks", () => {
  const request = (at: number) => ({
    agentId: AgentId("main"),
    at,
    host: "h.dev",
    via: "Bash",
    label: "",
  });

  test("marks sit on the bar edge and merge when they would touch", () => {
    const run = {
      ...single(thinking("a", 0, 100)),
      requests: [request(10), request(10.2), request(50)],
    };
    const [row] = frameOf(run).rows;
    expect(row?.requests.map((x) => x.items.length)).toEqual([2, 1]);
    const bar = row?.bars[0];
    expect(row?.requests[0]?.y).toBeLessThan(bar?.y ?? 0);
  });
});
