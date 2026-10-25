import type { Thread } from "@/domain/thread.ts";

// Sessions that share a working directory, which Claude calls a project.
export interface Group {
  readonly cwd: string;
  readonly sessions: readonly Thread[];
}

// The last two path segments name the directory.
export const dirName = (cwd: string) =>
  cwd.split("/").filter(Boolean).slice(-2).join("/") || cwd;

// Newest group first, and newest session first within it.
export const groupByDirectory = (sessions: readonly Thread[]): Group[] => {
  const byCwd = new Map<string, Thread[]>();
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

export const keyOf = (s: Thread) => `${s.harness}:${s.id}`;

export type NavItem =
  | { readonly kind: "group"; readonly group: Group }
  | { readonly kind: "session"; readonly session: Thread };

// Groups with their sessions underneath, as one flat list.
export const navItems = (groups: readonly Group[]): NavItem[] =>
  groups.flatMap((group) => [
    { kind: "group", group } as const,
    ...group.sessions.map((session) => ({ kind: "session", session }) as const),
  ]);

export type Move = "next" | "previous" | "nextGroup" | "previousGroup";

// Which session a key lands on, given where we are.
export const move = (
  groups: readonly Group[],
  current: Thread | undefined,
  by: Move,
): Thread | undefined => {
  const ordered = groups.flatMap((g) => g.sessions);
  const at = Math.max(
    0,
    ordered.findIndex((s) => current && keyOf(s) === keyOf(current)),
  );
  if (by === "next") return ordered[Math.min(at + 1, ordered.length - 1)];
  if (by === "previous") return ordered[Math.max(at - 1, 0)];
  const p = groups.findIndex((g) =>
    g.sessions.some((s) => current && keyOf(s) === keyOf(current)),
  );
  const target =
    by === "nextGroup"
      ? Math.min(p + 1, groups.length - 1)
      : Math.max(p - 1, 0);
  return groups[Math.max(0, target)]?.sessions[0];
};

// The slice of `items` around `focus` that fits in `budget`, growing outward from it.
export const visible = <T>(
  items: readonly T[],
  focus: number,
  budget: number,
  heightOf: (item: T) => number,
): readonly T[] => {
  let from = focus;
  let to = focus;
  let used = focus < items.length ? heightOf(items[focus] as T) : 0;
  for (;;) {
    const before = items[from - 1];
    const after = items[to + 1];
    const fitsBefore =
      before !== undefined && used + heightOf(before) <= budget;
    const fitsAfter = after !== undefined && used + heightOf(after) <= budget;
    if (!fitsBefore && !fitsAfter) break;
    if (fitsAfter && (!fitsBefore || to - focus <= focus - from)) {
      to += 1;
      used += heightOf(after as T);
    } else {
      from -= 1;
      used += heightOf(before as T);
    }
  }
  return items.slice(from, to + 1);
};
