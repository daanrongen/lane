import { describe, expect, test } from "bun:test";
import { AgentRef } from "@/domain/ids.ts";
import {
  condense,
  fileTree,
  leafCount,
  nodeCount,
  shared,
  type Touch,
} from "@/domain/tree.ts";
import { baseName, resolvePath, within } from "@/domain/workspace.ts";

const a = AgentRef("claude", "t1", "main");
const b = AgentRef("codex", "t2", "main");
const touch = (agent: typeof a, path: string, edits = 1, last = 1): Touch => ({
  agent,
  path,
  reads: 0,
  edits,
  last,
});

describe("resolvePath", () => {
  test("resolves relative paths from the cwd and collapses dots", () => {
    expect(resolvePath("/w/api", "src/a.ts")).toBe("/w/api/src/a.ts");
    expect(resolvePath("/w/api", "../web/./b.ts")).toBe("/w/web/b.ts");
    expect(resolvePath("/w", "/x//y")).toBe("/x/y");
  });

  test("within and baseName", () => {
    expect(within("/w/api", "/w/api/src")).toBe(true);
    expect(within("/w/api", "/w/api2/src")).toBe(false);
    expect(baseName("/w/api")).toBe("api");
  });
});

describe("fileTree", () => {
  const tree = fileTree("/w/api", [
    touch(a, "/w/api/packages/ui/Button.tsx", 2, 5),
    touch(b, "/w/api/packages/ui/Button.tsx", 1, 9),
    touch(a, "/w/api/src/index.ts"),
    touch(a, "/elsewhere/x.ts"),
  ]);

  test("holds only what was touched under the root", () => {
    expect(tree.children.map((c) => c.name).sort()).toEqual([
      "packages/ui",
      "src",
    ]);
    expect(JSON.stringify(tree)).not.toContain("elsewhere");
  });

  test("a chain of single folders reads as one step", () => {
    const ui = tree.children.find((c) => c.name === "packages/ui");
    expect(ui?.path).toBe("/w/api/packages/ui");
    expect(ui?.children[0]?.kind).toBe("file");
  });

  test("folders add up who worked below them", () => {
    const ui = tree.children.find((c) => c.name === "packages/ui");
    expect(Object.keys(ui?.agents ?? {}).sort()).toEqual([a, b].sort());
    expect(ui?.agents[a]?.edits).toBe(2);
    expect(tree.weight).toBe(4);
    expect(tree.agents[b]?.last).toBe(9);
  });

  test("a collided file marks every folder above it", () => {
    const hit = fileTree(
      "/w/api",
      [touch(a, "/w/api/src/x/y.ts")],
      new Set(["/w/api/src/x/y.ts"]),
    );
    expect(hit.collided).toBe(true);
    expect(hit.children[0]?.collided).toBe(true);
    expect(tree.collided).toBe(false);
  });

  test("an empty tree is just the root", () => {
    expect(fileTree("/w/api", [])).toMatchObject({
      name: "api",
      children: [],
      weight: 0,
    });
  });
});

describe("shared", () => {
  test("keeps only files several agents touched, with their folders", () => {
    const tree = fileTree("/w/api", [
      touch(a, "/w/api/packages/ui/Button.tsx"),
      touch(b, "/w/api/packages/ui/Button.tsx"),
      touch(a, "/w/api/src/index.ts"),
    ]);
    const only = shared(tree);
    expect(only?.children.map((c) => c.name)).toEqual(["packages/ui"]);
    expect(only?.children[0]?.children.map((c) => c.name)).toEqual([
      "Button.tsx",
    ]);
  });

  test("nothing shared leaves nothing", () => {
    const tree = fileTree("/w/api", [touch(a, "/w/api/x.ts")]);
    expect(shared(tree)).toBeUndefined();
  });
});

describe("condense", () => {
  const many = fileTree("/w/api", [
    touch(a, "/w/api/src/a.ts", 1, 1),
    touch(a, "/w/api/src/b.ts", 1, 2),
    touch(a, "/w/api/lib/d.ts", 1, 9),
    touch(a, "/w/api/lib/e.ts", 1, 4),
    touch(a, "/w/api/docs/x.md", 1, 3),
  ]);
  const names = (t: unknown) => JSON.stringify(t);

  test("a tree that fits is left alone", () => {
    expect(condense(many, 10, leafCount)).toBe(many);
  });

  test("closed folders stand for their files, the hottest open first", () => {
    const t = condense(many, 4, leafCount);
    expect(leafCount(t)).toBeLessThanOrEqual(4);
    expect(names(t)).toContain("d.ts");
    expect(names(t)).not.toContain("a.ts");
    expect(t.children.find((c) => c.name === "src")?.more).toBe(2);
  });

  test("a folder with many files shows the newest and counts the rest", () => {
    const wide = fileTree(
      "/w/api",
      [1, 2, 3, 4, 5, 6].map((i) => touch(a, `/w/api/f${i}.ts`, 1, i)),
    );
    const t = condense(wide, 4, leafCount);
    expect(t.children.map((c) => c.name)).toEqual([
      "f6.ts",
      "f5.ts",
      "f4.ts",
      "+3",
    ]);
  });

  test("a collided folder opens before a newer one", () => {
    const tree = fileTree(
      "/w/api",
      [
        touch(a, "/w/api/old/x.ts", 1, 1),
        touch(a, "/w/api/old/y.ts", 1, 1),
        touch(a, "/w/api/new/z.ts", 1, 9),
        touch(a, "/w/api/new/w.ts", 1, 9),
      ],
      new Set(["/w/api/old/x.ts"]),
    );
    const t = condense(tree, 3, leafCount);
    expect(names(t)).toContain("x.ts");
    expect(t.children.find((c) => c.name === "new")?.more).toBe(2);
  });

  test("it can measure rows as nodes for a tree that is listed", () => {
    expect(nodeCount(condense(many, 5, nodeCount))).toBeLessThanOrEqual(5);
  });
});
