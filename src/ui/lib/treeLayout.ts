import type { TreeNode } from "@/domain/tree.ts";
import type { Box } from "@/ui/lib/layout.ts";

export interface Placed {
  readonly node: TreeNode;
  readonly x: number;
  readonly y: number;
}

export interface TreeFrame {
  readonly nodes: readonly Placed[];
  // Elbow connectors, as thin boxes.
  readonly lines: readonly Box[];
  readonly height: number;
}

export const depthOf = (n: TreeNode): number =>
  1 + Math.max(0, ...n.children.map(depthOf));

// A tidy tree growing right: a leaf takes a row, a parent sits level with the middle of its children.
export const layoutTree = (
  root: TreeNode,
  width: number,
  row: number,
  label: number,
): TreeFrame => {
  const col = Math.max(label, Math.floor(width / depthOf(root)));
  const nodes: Placed[] = [];
  const lines: Box[] = [];
  let leaves = 0;

  const place = (node: TreeNode, depth: number): number => {
    const kids = node.children.map((c) => place(c, depth + 1));
    const y = kids.length
      ? ((kids[0] ?? 0) + (kids.at(-1) ?? 0)) / 2
      : leaves++ * row + row / 2;
    const x = depth * col;
    nodes.push({ node, x, y });
    if (kids.length) {
      const rail = x + col - label / 2;
      const first = Math.min(...kids);
      const last = Math.max(...kids);
      lines.push({ x: rail, y: first, width: 1, height: last - first });
      lines.push({
        x: x + label / 2,
        y,
        width: rail - x - label / 2,
        height: 1,
      });
      for (const k of kids) {
        lines.push({ x: rail, y: k, width: label / 2, height: 1 });
      }
    }
    return y;
  };
  place(root, 0);
  return { nodes, lines, height: Math.max(1, leaves) * row };
};

// A tree too deep to grow sideways: one row per node, each indented under its parent.
export const stackTree = (
  root: TreeNode,
  row: number,
  indent: number,
): TreeFrame => {
  const nodes: Placed[] = [];
  const visit = (node: TreeNode, depth: number) => {
    nodes.push({ node, x: depth * indent, y: nodes.length * row + row / 2 });
    for (const c of node.children) visit(c, depth + 1);
  };
  visit(root, 0);
  return { nodes, lines: [], height: nodes.length * row };
};
