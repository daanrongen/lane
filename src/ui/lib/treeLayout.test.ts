import { describe, expect, test } from "bun:test";
import type { TreeNode } from "@/domain/tree.ts";
import { layoutTree, stackTree } from "@/ui/lib/treeLayout.ts";

const node = (name: string, children: TreeNode[] = []): TreeNode => ({
  path: name,
  name,
  kind: children.length ? "folder" : "file",
  children,
  agents: {},
  weight: 1,
  collided: false,
});

describe("layoutTree", () => {
  const tree = node("root", [node("a"), node("b", [node("c"), node("d")])]);
  const frame = layoutTree(tree, 300, 20, 40);
  const at = (name: string) => frame.nodes.find((n) => n.node.name === name);

  test("leaves take a row each, parents sit level with their children", () => {
    expect(frame.height).toBe(60);
    expect([at("a")?.y, at("c")?.y, at("d")?.y]).toEqual([10, 30, 50]);
    expect(at("b")?.y).toBe(40);
    expect(at("root")?.y).toBe(25);
  });

  test("depth sets the column", () => {
    expect([at("root")?.x, at("b")?.x, at("c")?.x]).toEqual([0, 100, 200]);
  });

  test("a lone node needs no connectors", () => {
    expect(layoutTree(node("x"), 100, 20, 40).lines).toEqual([]);
  });
});

describe("stackTree", () => {
  test("one row per node, children indented under their parent", () => {
    const frame = stackTree(node("root", [node("a"), node("b")]), 10, 4);
    expect(frame.nodes.map((n) => [n.node.name, n.x, n.y])).toEqual([
      ["root", 0, 5],
      ["a", 4, 15],
      ["b", 4, 25],
    ]);
    expect(frame.height).toBe(30);
  });
});
