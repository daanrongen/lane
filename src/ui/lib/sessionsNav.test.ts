import { describe, expect, test } from "bun:test";
import { SessionId } from "@/domain/ids.ts";
import { groupByProject } from "@/domain/projects.ts";
import type { Session } from "@/domain/session.ts";
import { move, navItems, visible } from "@/ui/lib/sessionsNav.ts";

const s = (id: string, cwd: string, updatedAt: number): Session => ({
  harness: "claude",
  id: SessionId(id),
  cwd,
  status: "past",
  updatedAt,
});

const groups = groupByProject([
  s("a1", "/a", 9),
  s("a2", "/a", 8),
  s("b1", "/b", 5),
  s("c1", "/c", 1),
]);

describe("move", () => {
  const id = (x?: Session) => (x ? String(x.id) : undefined);
  test("next and previous walk every session and stop at the ends", () => {
    expect(id(move(groups, groups[0]?.sessions[0], "next"))).toBe("a2");
    expect(id(move(groups, groups[2]?.sessions[0], "next"))).toBe("c1");
    expect(id(move(groups, groups[0]?.sessions[0], "previous"))).toBe("a1");
  });

  test("project jumps land on the first session of the neighbour", () => {
    expect(id(move(groups, groups[0]?.sessions[1], "nextProject"))).toBe("b1");
    expect(id(move(groups, groups[1]?.sessions[0], "previousProject"))).toBe(
      "a1",
    );
  });
});

describe("navItems and visible", () => {
  test("projects head their sessions", () => {
    expect(navItems(groups).map((i) => i.kind)).toEqual([
      "project",
      "session",
      "session",
      "project",
      "session",
      "project",
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
