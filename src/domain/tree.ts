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
