import { describe, expect, test } from "bun:test";
import type { Floor } from "@/domain/floor.ts";
import { AgentRef } from "@/domain/ids.ts";
import { fileTree } from "@/domain/tree.ts";
import { changes } from "@/ui/lib/changes.ts";

const a = AgentRef("claude", "t", "main");
const b = AgentRef("codex", "u", "main");
const touch = (agent: AgentRef, path: string, edits: number, last: number) => ({
  agent,
  path,
  reads: 1,
  edits,
  last,
});

describe("changes", () => {
  const tree = fileTree(
    "/w",
    [
      touch(a, "/w/src/a.ts", 2, 100),
      touch(b, "/w/src/a.ts", 1, 300),
      touch(a, "/w/src/read.ts", 0, 900),
      touch(a, "/w/b.ts", 1, 200),
    ],
    new Set(["/w/src/a.ts"]),
  );
  const out = changes({
    workspaces: [{ root: "/w", tree }],
  } as unknown as Floor);

  test("lists only edited files, latest first, with who and how often", () => {
    expect(out.map((c) => [c.short, c.edits, c.agents.length])).toEqual([
      ["src/a.ts", 3, 2],
      ["b.ts", 1, 1],
    ]);
  });

  test("a collision is carried through", () => {
    expect(out.map((c) => c.collided)).toEqual([true, false]);
  });
});
