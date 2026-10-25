import { describe, expect, test } from "bun:test";
import { AgentRef } from "@/domain/ids.ts";
import { fileTree, shared, type Touch } from "@/domain/tree.ts";
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
