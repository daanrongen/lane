import type { SkillUse } from "@/domain/run.ts";

export interface SkillSummary {
  readonly name: string;
  readonly count: number;
  readonly first: number;
  readonly last: number;
  readonly via: readonly string[];
}

// Which skills were used, most used first.
export const skillsUsed = (uses: readonly SkillUse[]): SkillSummary[] => {
  const byName = new Map<string, SkillSummary>();
  for (const u of uses) {
    const prev = byName.get(u.name);
    byName.set(u.name, {
      name: u.name,
      count: (prev?.count ?? 0) + 1,
      first: Math.min(prev?.first ?? u.at, u.at),
      last: Math.max(prev?.last ?? u.at, u.at),
      via: [...new Set([...(prev?.via ?? []), u.via])],
    });
  }
  return [...byName.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
};

// A plugin skill is `plugin:name`; the catalog lists it by its own name.
export const skillKey = (name: string) => name.split(":").at(-1) ?? name;
