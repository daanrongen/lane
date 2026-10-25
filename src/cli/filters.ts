import type { AgentView } from "@/domain/floor.ts";
import type { Thread } from "@/domain/thread.ts";
import { resolvePath, within } from "@/domain/workspace.ts";

export interface Scope {
  readonly harness?: string;
  readonly workspace?: string;
  readonly limit?: string;
  readonly since?: string;
  readonly live?: boolean;
  readonly past?: boolean;
  readonly status?: string;
  readonly state?: string;
}

const UNITS: Readonly<Record<string, number>> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

// `90s`, `15m`, `2h`, `3d` as milliseconds.
export const parseSince = (s: string): number | undefined => {
  const m = /^(\d+)([smhd])$/.exec(s);
  return m ? Number(m[1]) * (UNITS[m[2] ?? ""] ?? 0) : undefined;
};

// `-n`, else `fallback` rows.
export const limitOf = (o: Scope, fallback = Number.POSITIVE_INFINITY) => {
  const n = Number(o.limit);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const rootOf = (o: Scope, cwd: string) =>
  o.workspace === undefined ? undefined : resolvePath(cwd, o.workspace);

export const threadsWhere = (
  threads: readonly Thread[],
  o: Scope,
  cwd: string,
  now: number,
) => {
  const root = rootOf(o, cwd);
  const since = o.since === undefined ? undefined : parseSince(o.since);
  return threads.filter(
    (t) =>
      (!o.harness || t.harness === o.harness) &&
      (!root || within(root, t.cwd)) &&
      (!o.live || t.status !== "past") &&
      (!o.past || t.status === "past") &&
      (o.status === undefined || t.status === o.status) &&
      (since === undefined || now - t.updatedAt <= since),
  );
};

export const agentsWhere = (
  agents: readonly AgentView[],
  o: Scope,
  cwd: string,
) => {
  const root = rootOf(o, cwd);
  return agents.filter(
    (v) =>
      (!o.harness || v.harness === o.harness) &&
      (!root || within(root, v.workspace)) &&
      (o.state === undefined || v.state === o.state),
  );
};
