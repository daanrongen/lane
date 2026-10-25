import type { AgentView, Floor, WorkspaceView } from "@/domain/floor.ts";
import type { AgentRef } from "@/domain/ids.ts";

export interface Group {
  readonly workspace: WorkspaceView;
  readonly agents: readonly AgentView[];
  // Finished sub-agents left out of `agents`.
  readonly retired: number;
}

// How long a finished sub-agent stays in view (ms).
export const LINGER = 30_000;

const retired = (a: AgentView, now: number) =>
  a.depth > 0 && a.state === "done" && now - (a.lastEventAt ?? 0) >= LINGER;

export interface Show {
  // Epoch ms.
  readonly now: number;
  // This agent stays even when it has finished.
  readonly keep?: AgentRef;
  // Show every sub-agent.
  readonly all?: boolean;
}

// Roots by name with their sub-agents after them, so rows stay put while agents work.
const arranged = (agents: readonly AgentView[]) =>
  agents
    .filter((a) => a.depth === 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.ref.localeCompare(b.ref))
    .flatMap((root) => [
      root,
      ...agents.filter((a) => a.depth > 0 && a.thread === root.thread),
    ]);

export const groups = (floor: Floor, show: Show): readonly Group[] => {
  const byRef = new Map(floor.agents.map((a) => [a.ref, a]));
  return [...floor.workspaces]
    .sort((a, b) => a.root.localeCompare(b.root))
    .map((workspace) => {
      const all = workspace.agents.flatMap((r) => byRef.get(r) ?? []);
      const gone = (a: AgentView) =>
        !show.all && a.ref !== show.keep && retired(a, show.now);
      return {
        workspace,
        agents: arranged(all.filter((a) => !gone(a))),
        retired: all.filter(gone).length,
      };
    });
};

export const order = (gs: readonly Group[]) => gs.flatMap((g) => g.agents);

// The agent before or after `from`, wrapping round; the first when nothing is selected.
export const step = (
  agents: readonly AgentView[],
  from: AgentRef | undefined,
  by: 1 | -1,
) => {
  const at = agents.findIndex((a) => a.ref === from);
  if (at < 0) return agents[by === 1 ? 0 : agents.length - 1];
  return agents[(at + by + agents.length) % agents.length];
};

// Like `step`, over the agents that need a person, are stalled or failed.
export const stepAttention = (
  floor: Floor,
  agents: readonly AgentView[],
  from: AgentRef | undefined,
  by: 1 | -1,
) => {
  const wanted = new Set(floor.attention.map((a) => a.agent));
  return step(
    agents.filter((a) => wanted.has(a.ref) || a.ref === from),
    from,
    by,
  );
};
