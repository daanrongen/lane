import { describe, expect, test } from "bun:test";
import { ThreadId } from "@/domain/ids.ts";
import type { Thread } from "@/domain/thread.ts";
import {
  dirName,
  groupByDirectory,
  move,
  navItems,
  visible,
} from "@/ui/lib/sessionsNav.ts";

const s = (id: string, cwd: string, updatedAt: number): Thread => ({
  harness: "claude",
  id: ThreadId(id),
  cwd,
  status: "past",
  updatedAt,
});

const groups = groupByDirectory([
  s("a1", "/a", 9),
  s("a2", "/a", 8),
  s("b1", "/b", 5),
  s("c1", "/c", 1),
]);

describe("move", () => {
  const id = (x?: Thread) => (x ? String(x.id) : undefined);
  test("next and previous walk every session and stop at the ends", () => {
    expect(id(move(groups, groups[0]?.sessions[0], "next"))).toBe("a2");
    expect(id(move(groups, groups[2]?.sessions[0], "next"))).toBe("c1");
    expect(id(move(groups, groups[0]?.sessions[0], "previous"))).toBe("a1");
  });

  test("group jumps land on the first session of the neighbour", () => {
    expect(id(move(groups, groups[0]?.sessions[1], "nextGroup"))).toBe("b1");
    expect(id(move(groups, groups[1]?.sessions[0], "previousGroup"))).toBe(
      "a1",
    );
  });
});

describe("navItems and visible", () => {
  test("projects head their sessions", () => {
    expect(navItems(groups).map((i) => i.kind)).toEqual([
      "group",
      "session",
      "session",
      "group",
      "session",
      "group",
      "session",
    ]);
  });

  test("the window grows around the focus within its budget", () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(visible(items, 5, 3, () => 1)).toEqual([4, 5, 6]);
    expect(visible(items, 0, 3, () => 1)).toEqual([0, 1, 2]);
    expect(visible(items, 9, 4, () => 1)).toEqual([6, 7, 8, 9]);
  });
});

describe("groupByDirectory", () => {
  test("a group per directory across harnesses, newest first", () => {
    const mixed = groupByDirectory([
      s("a", "/x/one", 1),
      s("b", "/x/two", 9),
      { ...s("c", "/x/one", 5), harness: "codex" },
    ]);
    expect(
      mixed.map((g) => [g.cwd, g.sessions.map((x) => String(x.id))]),
    ).toEqual([
      ["/x/two", ["b"]],
      ["/x/one", ["c", "a"]],
    ]);
  });

  test("a directory is named by its last two segments", () => {
    expect(dirName("/Users/me/Developer/gpuix")).toBe("Developer/gpuix");
    expect(dirName("/")).toBe("/");
  });
});
