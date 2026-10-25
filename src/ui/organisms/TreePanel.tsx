import { Button } from "@gpuix/react";
import { useMemo } from "react";
import type { AgentView, Floor, WorkspaceView } from "@/domain/floor.ts";
import type { AgentRef } from "@/domain/ids.ts";
import { file, folder, type Ref } from "@/domain/ref.ts";
import {
  condense,
  leafCount,
  nodeCount,
  shared,
  type TreeNode,
} from "@/domain/tree.ts";
import { baseName } from "@/domain/workspace.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { harnessColor } from "@/ui/lib/look.ts";
import { alpha } from "@/ui/lib/theme.ts";
import { depthOf, layoutTree, stackTree } from "@/ui/lib/treeLayout.ts";

const RECENT = 120_000;

const Workspace = ({
  space,
  full,
  rows,
  agents,
  now,
  width,
  selected,
  onPick,
}: {
  space: WorkspaceView;
  full: TreeNode;
  // Rows this workspace may take; the rest of its files are counted, not drawn.
  rows: number;
  agents: ReadonlyMap<AgentRef, AgentView>;
  now: number;
  width: number;
  selected?: AgentRef;
  onPick: (ref: Ref) => void;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const wide = Math.round(r.charWidth * 9);
  const label = wide + r.dot * 7;
  const tight = useMemo(() => condense(full, rows, leafCount), [full, rows]);
  // Too deep to grow sideways: list it, indented.
  const stacked = depthOf(tight) * label > width - r.dot * 2;
  const tree = useMemo(
    () => (stacked ? condense(full, rows, nodeCount) : tight),
    [stacked, full, rows, tight],
  );
  const name = stacked ? Math.round(r.charWidth * 18) : wide;
  const frame = useMemo(
    () =>
      stacked
        ? stackTree(tree, r.row, r.dot * 2)
        : layoutTree(tree, width - r.dot * 2, r.row, label),
    [tree, stacked, width, r.dot, r.row, label],
  );
  return (
    <Column>
      <Row
        gap={r.dot}
        style={{
          height: r.row,
          paddingLeft: r.dot,
          backgroundColor: alpha(theme.text, 0.04),
        }}
      >
        <Text>{baseName(space.root)}</Text>
        <Text size="small" tone="dim">
          {space.branch ?? ""}
        </Text>
      </Row>
      <div
        style={{
          position: "relative",
          width,
          height: frame.height,
          overflow: "hidden",
          marginLeft: r.dot,
        }}
      >
        {frame.lines.map((box) => (
          <div
            key={`${box.x}:${box.y}:${box.width}:${box.height}`}
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              backgroundColor: alpha(theme.dim, 0.5),
            }}
          />
        ))}
        {frame.nodes.map(({ node, x, y }) => {
          const size = Math.round(
            Math.min(r.dot * 1.8, r.dot * 0.8 + Math.sqrt(node.weight) * 2),
          );
          const here = Object.entries(node.agents);
          const mine = selected !== undefined && selected in node.agents;
          const color = node.collided ? theme.failed : theme.text;
          if (node.kind === "file" && node.more !== undefined) {
            return (
              <Text
                key={node.path}
                size="small"
                tone="dim"
                style={{
                  position: "absolute",
                  left: x + size + Math.round(r.dot / 2),
                  top: y - r.row / 2,
                  height: r.row,
                }}
              >
                {`+${node.more} more`}
              </Text>
            );
          }
          return (
            <Button
              key={node.path}
              onClick={() =>
                onPick(
                  node.kind === "folder" ? folder(node.path) : file(node.path),
                )
              }
              style={{
                position: "absolute",
                left: x,
                top: y - r.row / 2,
                height: r.row,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: Math.round(r.dot / 2),
              }}
            >
              <div
                style={{
                  width: size,
                  height: size,
                  flexShrink: 0,
                  borderRadius: node.kind === "folder" ? size / 2 : 2,
                  borderWidth: mine ? 2 : 1,
                  borderColor: mine ? theme.agents[0] : color,
                  backgroundColor:
                    node.kind === "file" ? alpha(color, 0.7) : undefined,
                }}
              />
              <Text
                size="small"
                tone={node.collided ? "failed" : "text"}
                style={{ width: name }}
              >
                {node.name}
              </Text>
              {node.more !== undefined ? (
                <Text size="small" tone="dim">
                  {`${node.more} ${node.more === 1 ? "file" : "files"}`}
                </Text>
              ) : null}
              {here.slice(0, 3).map(([ref, p]) => {
                const agent = agents.get(ref as AgentRef);
                return (
                  <div
                    key={ref}
                    style={{
                      width: r.dot,
                      height: r.dot,
                      flexShrink: 0,
                      borderRadius: r.dot / 2,
                      backgroundColor: harnessColor(
                        agent?.harness ?? "",
                        theme,
                      ),
                      opacity: now - p.last < RECENT ? 1 : 0.4,
                    }}
                  />
                );
              })}
              {node.collided && node.kind === "file" ? (
                <Text size="small" tone="failed">
                  ⚠
                </Text>
              ) : null}
            </Button>
          );
        })}
      </div>
    </Column>
  );
};

// Where agents are working: each workspace's touched files as a tree, with agents drawn on the nodes.
export const TreePanel = ({
  floor,
  now,
  width,
  selected,
  onlyShared,
  rows,
  onPick,
}: {
  // Rows to share between the workspaces.
  rows: number;
  floor: Floor;
  now: number;
  width: number;
  selected?: AgentRef;
  onlyShared: boolean;
  onPick: (ref: Ref) => void;
}) => {
  const r = useMetrics();
  const agents = useMemo(
    () => new Map(floor.agents.map((a) => [a.ref, a])),
    [floor.agents],
  );
  const spaces = useMemo(
    () =>
      [...floor.workspaces]
        .sort((a, b) => a.root.localeCompare(b.root))
        .flatMap((w) => {
          const tree = onlyShared ? shared(w.tree) : w.tree;
          return tree && tree.children.length > 0 ? [{ space: w, tree }] : [];
        }),
    [floor.workspaces, onlyShared],
  );
  const total = Math.max(
    1,
    spaces.reduce((n, { tree }) => n + tree.weight, 0),
  );
  return (
    <Column style={{ width, flexShrink: 0 }}>
      <Row style={{ height: r.row, paddingLeft: r.dot }}>
        <Text size="small" tone="dim">
          {onlyShared ? "WHERE THEY WORK · SHARED FILES" : "WHERE THEY WORK"}
        </Text>
      </Row>
      {spaces.length === 0 ? (
        <Text tone="dim" style={{ paddingLeft: r.dot }}>
          {onlyShared ? "no file is shared yet" : "no files touched yet"}
        </Text>
      ) : (
        spaces.map(({ space, tree }) => (
          <Workspace
            key={space.root}
            space={space}
            full={tree}
            rows={Math.max(3, Math.round((rows * tree.weight) / total))}
            agents={agents}
            now={now}
            width={width}
            selected={selected}
            onPick={onPick}
          />
        ))
      )}
    </Column>
  );
};
