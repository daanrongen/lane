import type { Project } from "@/domain/projects.ts";
import type { Session } from "@/domain/session.ts";

export const keyOf = (s: Session) => `${s.harness}:${s.id}`;

export type NavItem =
  | { readonly kind: "project"; readonly project: Project }
  | { readonly kind: "session"; readonly session: Session };

// Projects with their sessions underneath, as one flat list.
export const navItems = (groups: readonly Project[]): NavItem[] =>
  groups.flatMap((project) => [
    { kind: "project", project } as const,
    ...project.sessions.map(
      (session) => ({ kind: "session", session }) as const,
    ),
  ]);

export type Move = "next" | "previous" | "nextProject" | "previousProject";

// Which session a key lands on, given where we are.
export const move = (
  groups: readonly Project[],
  current: Session | undefined,
  by: Move,
): Session | undefined => {
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
    by === "nextProject"
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
