import { type Asset, ofKind } from "@/domain/assets.ts";
import type { ModelUse } from "@/domain/models.ts";
import { type SkillSummary, skillKey } from "@/domain/skills.ts";
import { type Card, modelUseCard, skillCard } from "@/ui/lib/cards.ts";
import { modelName } from "@/ui/lib/format.ts";
import { providerColor } from "@/ui/lib/look.ts";
import type { Theme } from "@/ui/lib/theme.ts";

export interface Chip {
  readonly label: string;
  readonly detail: string;
  readonly color?: string;
  readonly card: Card;
}

// What a skill is for, when the machine's catalog knows it.
export const describeSkill = (catalog: readonly Asset[], name: string) =>
  ofKind(catalog, "Skill").find((s) => s.name === skillKey(name))
    ?.description || undefined;

export const skillChips = (
  skills: readonly SkillSummary[],
  catalog: readonly Asset[],
): Chip[] =>
  skills.map((s) => ({
    label: s.name,
    detail: `×${s.count}`,
    card: skillCard(s, describeSkill(catalog, s.name)),
  }));

export const modelChips = (uses: readonly ModelUse[], theme: Theme): Chip[] =>
  uses.map((u) => ({
    label: modelName(u.model),
    detail: `${u.turns} ${u.turns === 1 ? "turn" : "turns"}`,
    color: providerColor(u.provider, theme),
    card: modelUseCard(u),
  }));
