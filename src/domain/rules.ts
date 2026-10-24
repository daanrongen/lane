import type { Asset } from "@/domain/assets.ts";

export type PermissionRule = Extract<Asset, { _tag: "Rule" }>;

// `Bash(git status:*)` -> the tool and the argument pattern, if any.
const split = (pattern: string) => {
  const m = /^([^(]+)(?:\((.*)\))?$/.exec(pattern);
  return { tool: m?.[1] ?? pattern, arg: m?.[2] };
};

const covers = (rule: PermissionRule, tool: string, label: string) => {
  const { tool: ruleTool, arg } = split(rule.pattern);
  if (ruleTool !== tool) return false;
  if (arg === undefined || arg === "*") return true;
  return arg.endsWith(":*")
    ? label.startsWith(arg.slice(0, -2))
    : arg === label;
};

// The rule that applies to a call, if one does; a deny beats an allow.
export const ruleFor = (
  rules: readonly PermissionRule[],
  tool: string,
  label: string,
): PermissionRule | undefined =>
  rules.find((r) => r.effect === "deny" && covers(r, tool, label)) ??
  rules.find((r) => r.effect === "allow" && covers(r, tool, label));
