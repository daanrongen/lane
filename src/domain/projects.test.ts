import { describe, expect, test } from "bun:test";
import { SessionId } from "@/domain/ids.ts";
import { groupByProject, projectName } from "@/domain/projects.ts";
import type { Session } from "@/domain/session.ts";

const s = (
  id: string,
  cwd: string,
  updatedAt: number,
  harness = "claude",
): Session => ({
  harness: harness as Session["harness"],
  id: SessionId(id),
  cwd,
  status: "past",
  updatedAt,
});

describe("groupByProject", () => {
  test("one project per directory across harnesses, newest first", () => {
    const groups = groupByProject([
      s("a", "/x/one", 1),
      s("b", "/x/two", 9),
      s("c", "/x/one", 5, "codex"),
    ]);
    expect(
      groups.map((g) => [g.cwd, g.sessions.map((x) => String(x.id))]),
    ).toEqual([
      ["/x/two", ["b"]],
      ["/x/one", ["c", "a"]],
    ]);
  });

  test("a project is named by its last two segments", () => {
    expect(projectName("/Users/me/Developer/gpuix")).toBe("Developer/gpuix");
    expect(projectName("/")).toBe("/");
  });
});
