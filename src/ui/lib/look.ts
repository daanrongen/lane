import type { StyleDesc } from "@gpuix/react";
import type { CellKind } from "@/domain/context.ts";
import type { HarnessId } from "@/domain/session.ts";
import type { Bar } from "@/domain/timeline.ts";
import { alpha, type Theme } from "@/ui/lib/theme.ts";

// One look per bar kind, shared by the plot and the legend.
export const barLook = (
  kind: Bar["kind"],
  failed: boolean,
  color: string,
  theme: Theme,
): StyleDesc => {
  if (failed) {
    return {
      backgroundColor: alpha(theme.failed, 0.3),
      borderWidth: 1,
      borderColor: theme.failed,
    };
  }
  switch (kind) {
    case "Thinking":
      return { backgroundColor: alpha(color, 0.35) };
    case "ToolCall":
      return { backgroundColor: color };
    case "McpCall":
      return {
        backgroundColor: alpha(color, 0.15),
        borderWidth: 2,
        borderColor: color,
      };
    case "Waiting":
      return {
        backgroundColor: alpha(color, 0.1),
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: alpha(color, 0.5),
      };
  }
};

// Each kind of context gets one hue from the palette; free space is hatched.
export const cellLook = (kind: CellKind, theme: Theme) => {
  const color = {
    System: theme.dim,
    Message: theme.agents[0],
    File: theme.agents[1],
    Tool: theme.agents[2],
    Tools: theme.agents[3],
    Free: theme.dim,
  }[kind] as string;
  const style: StyleDesc =
    kind === "Free"
      ? {
          backgroundColor: alpha(color, 0.06),
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: alpha(color, 0.4),
        }
      : {
          backgroundColor: alpha(color, 0.18),
          borderWidth: 1,
          borderColor: alpha(color, 0.5),
        };
  return { color, style };
};

// Each harness gets one hue, so sessions read apart at a glance.
export const harnessColor = (harness: HarnessId, theme: Theme) =>
  ({ claude: theme.agents[2], codex: theme.agents[3] })[harness] ?? theme.dim;
