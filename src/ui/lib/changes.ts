import type { Floor } from "@/domain/floor.ts";
import type { AgentRef } from "@/domain/ids.ts";
import type { TreeNode } from "@/domain/tree.ts";

export interface Change {
  readonly path: string;
  // The path from its workspace root.
  readonly short: string;
  readonly workspace: string;
  readonly agents: readonly AgentRef[];
  readonly edits: number;
  readonly collided: boolean;
  // Epoch ms of the latest edit.
  readonly last: number;
}

const files = (n: TreeNode): TreeNode[] =>
  n.kind === "file" ? [n] : n.children.flatMap(files);

// Files agents have edited, latest first.
export const changes = (floor: Floor): Change[] =>
  floor.workspaces
    .flatMap((w) =>
      files(w.tree).flatMap((f) => {
        const edited = Object.entries(f.agents).filter(([, p]) => p.edits > 0);
        if (edited.length === 0) return [];
        return [
          {
            path: f.path,
            short: f.path.slice(w.root.length + 1),
            workspace: w.root,
            agents: edited.map(([ref]) => ref as AgentRef),
            edits: edited.reduce((n, [, p]) => n + p.edits, 0),
            collided: f.collided,
            last: Math.max(...edited.map(([, p]) => p.last)),
          },
        ];
      }),
    )
    .sort((a, b) => b.last - a.last);
