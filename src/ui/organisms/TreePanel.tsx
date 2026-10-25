import { useMemo } from "react";
import type { AgentView, Floor, WorkspaceView } from "@/domain/floor.ts";
import type { AgentRef } from "@/domain/ids.ts";
import { baseName } from "@/domain/workspace.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { harnessColor } from "@/ui/lib/look.ts";
import { alpha } from "@/ui/lib/theme.ts";
import { layoutTree } from "@/ui/lib/treeLayout.ts";

const RECENT = 120_000;

const Workspace = ({
  space,
  agents,
  now,
  width,
  selected,
}: {
  space: WorkspaceView;
  agents: ReadonlyMap<AgentRef, AgentView>;
  now: number;
  width: number;
  selected?: AgentRef;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const name = Math.round(r.charWidth * 9);
  const label = name + r.dot * 7;
  const frame = useMemo(
    () => layoutTree(space.tree, width - r.dot * 2, r.row, label),
    [space.tree, width, r.dot, r.row, label],
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
          return (
            <div
              key={node.path}
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
            </div>
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
}: {
  floor: Floor;
  now: number;
  width: number;
  selected?: AgentRef;
}) => {
  const r = useMetrics();
  const agents = useMemo(
    () => new Map(floor.agents.map((a) => [a.ref, a])),
    [floor.agents],
  );
  const spaces = useMemo(
    () =>
      [...floor.workspaces]
        .filter((w) => w.tree.children.length > 0)
        .sort((a, b) => a.root.localeCompare(b.root)),
    [floor.workspaces],
  );
  return (
    <Column style={{ width, flexShrink: 0 }}>
      <Row style={{ height: r.row, paddingLeft: r.dot }}>
        <Text size="small" tone="dim">
          WHERE THEY WORK
        </Text>
      </Row>
      {spaces.length === 0 ? (
        <Text tone="dim" style={{ paddingLeft: r.dot }}>
          no files touched yet
        </Text>
      ) : (
        spaces.map((w) => (
          <Workspace
            key={w.root}
            space={w}
            agents={agents}
            now={now}
            width={width}
            selected={selected}
          />
        ))
      )}
    </Column>
  );
};
