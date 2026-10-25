import type { AgentRef } from "@/domain/ids.ts";
import { baseName, within } from "@/domain/workspace.ts";

export interface Presence {
  readonly reads: number;
  readonly edits: number;
  // Epoch ms.
  readonly last: number;
}

// An agent's use of one file, with an absolute path.
export interface Touch extends Presence {
  readonly agent: AgentRef;
  readonly path: string;
}

export interface TreeNode {
  readonly path: string;
  readonly name: string;
  readonly kind: "folder" | "file";
  readonly children: readonly TreeNode[];
  // Who is working at or below this node.
  readonly agents: Readonly<Record<string, Presence>>;
  // Touches at or below this node; sizes the node.
  readonly weight: number;
  readonly collided: boolean;
  // Files left out below this node, when it was condensed.
  readonly more?: number;
}

const merge = (a: Presence | undefined, b: Presence): Presence => ({
  reads: (a?.reads ?? 0) + b.reads,
  edits: (a?.edits ?? 0) + b.edits,
  last: Math.max(a?.last ?? 0, b.last),
});

interface Draft {
  path: string;
  name: string;
  kind: "folder" | "file";
  children: Map<string, Draft>;
  agents: Map<string, Presence>;
  weight: number;
}

const draft = (path: string, name: string, kind: Draft["kind"]): Draft => ({
  path,
  name,
  kind,
  children: new Map(),
  agents: new Map(),
  weight: 0,
});

const seal = (d: Draft, collided: ReadonlySet<string>): TreeNode => {
  const kids = [...d.children.values()].map((c) => seal(c, collided));
  // A folder holding one folder reads as one step: `packages/ui`.
  const only = kids.length === 1 ? kids[0] : undefined;
  if (only && only.kind === "folder" && d.kind === "folder" && d.path !== "") {
    return { ...only, name: `${d.name}/${only.name}` };
  }
  return {
    path: d.path,
    name: d.name,
    kind: d.kind,
    children: kids.sort(
      (a, b) =>
        (a.kind === "folder" ? 0 : 1) - (b.kind === "folder" ? 0 : 1) ||
        b.weight - a.weight ||
        a.name.localeCompare(b.name),
    ),
    agents: Object.fromEntries(d.agents),
    weight: d.weight,
    collided: collided.has(d.path) || kids.some((k) => k.collided),
  };
};

// Only the part of the tree agents have touched; `root` is the workspace.
export const fileTree = (
  root: string,
  touches: readonly Touch[],
  collided: ReadonlySet<string> = new Set(),
): TreeNode => {
  const top = draft(root, baseName(root), "folder");
  for (const t of touches) {
    if (!within(root, t.path) || t.path === root) continue;
    const parts = t.path.slice(root.length).split("/").filter(Boolean);
    let node = top;
    const path = [root === "/" ? "" : root];
    for (const [i, part] of parts.entries()) {
      path.push(part);
      const key = path.join("/");
      const kind = i === parts.length - 1 ? "file" : "folder";
      const next = node.children.get(part) ?? draft(key, part, kind);
      node.children.set(part, next);
      node = next;
      node.weight += t.reads + t.edits;
      node.agents.set(t.agent, merge(node.agents.get(t.agent), t));
    }
    top.weight += t.reads + t.edits;
    top.agents.set(t.agent, merge(top.agents.get(t.agent), t));
  }
  return seal(top, collided);
};

// Only the files more than one agent touched, and the folders leading to them.
export const shared = (n: TreeNode): TreeNode | undefined => {
  if (n.kind === "file") {
    return Object.keys(n.agents).length > 1 ? n : undefined;
  }
  const children = n.children.flatMap((c) => shared(c) ?? []);
  return children.length > 0 ? { ...n, children } : undefined;
};

const newest = (n: TreeNode) =>
  Math.max(0, ...Object.values(n.agents).map((p) => p.last));

// Files at or below a node, counting those a condensed node stands for.
const size = (n: TreeNode): number =>
  n.more ??
  (n.kind === "file" ? 1 : n.children.reduce((s, c) => s + size(c), 0));

// A collision outranks everything; then the latest touch.
const interest = (n: TreeNode) => (n.collided ? Number.MAX_VALUE : newest(n));

// Files an open folder shows before counting the rest.
const FILES = 3;

const rest = (n: TreeNode, hidden: number): TreeNode => ({
  path: `${n.path}/…`,
  name: `+${hidden}`,
  kind: "file",
  children: [],
  agents: {},
  weight: 0,
  collided: false,
  more: hidden,
});

// The tree with only the `open` folders spread out; the others stand for their files.
const view = (n: TreeNode, open: ReadonlySet<string>): TreeNode => {
  if (n.kind === "file") return n;
  if (!open.has(n.path)) return { ...n, children: [], more: size(n) };
  const files = n.children
    .filter((c) => c.kind === "file")
    .sort((a, b) => interest(b) - interest(a));
  const shown = files.length > FILES + 1 ? files.slice(0, FILES) : files;
  return {
    ...n,
    children: [
      ...n.children
        .filter((c) => c.kind === "folder")
        .map((c) => view(c, open)),
      ...shown,
      ...(files.length > shown.length
        ? [rest(n, files.length - shown.length)]
        : []),
    ],
  };
};

const closed = (n: TreeNode): TreeNode[] =>
  n.kind === "folder" && n.more !== undefined
    ? [n]
    : n.children.flatMap(closed);

// Fits a tree into `rows` by opening folders hottest first, until the next one would not fit.
export const condense = (
  n: TreeNode,
  rows: number,
  measure: (t: TreeNode) => number,
): TreeNode => {
  if (measure(n) <= rows) return n;
  const open = new Set([n.path]);
  let tree = view(n, open);
  const skipped = new Set<string>();
  for (;;) {
    const next = closed(tree)
      .filter((c) => !skipped.has(c.path))
      .sort((a, b) => interest(b) - interest(a))
      .map((c) => ({ c, t: view(n, new Set([...open, c.path])) }))
      .find(({ c, t }) => {
        const fits = measure(t) <= rows;
        if (!fits) skipped.add(c.path);
        return fits;
      });
    if (!next) return tree;
    open.add(next.c.path);
    tree = next.t;
  }
};

export const leafCount = (n: TreeNode): number =>
  n.children.length === 0
    ? 1
    : n.children.reduce((s, c) => s + leafCount(c), 0);

export const nodeCount = (n: TreeNode): number =>
  1 + n.children.reduce((s, c) => s + nodeCount(c), 0);
