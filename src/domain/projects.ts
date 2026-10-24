import type { Session } from "@/domain/session.ts";

export interface Project {
  readonly cwd: string;
  readonly sessions: readonly Session[];
}

// Where the work happened: the last two path segments.
export const projectName = (cwd: string) =>
  cwd.split("/").filter(Boolean).slice(-2).join("/") || cwd;

// A project is a working directory, whichever harness ran in it. Newest first.
export const groupByProject = (sessions: readonly Session[]): Project[] => {
  const byCwd = new Map<string, Session[]>();
  for (const s of sessions) byCwd.set(s.cwd, [...(byCwd.get(s.cwd) ?? []), s]);
  return [...byCwd]
    .map(([cwd, list]) => ({
      cwd,
      sessions: list.sort((a, b) => b.updatedAt - a.updatedAt),
    }))
    .sort(
      (a, b) =>
        (b.sessions[0]?.updatedAt ?? 0) - (a.sessions[0]?.updatedAt ?? 0),
    );
};
