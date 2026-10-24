import { describe, expect, test } from "bun:test";
import type { Asset } from "@/domain/assets.ts";
import { themeDark } from "@/ui/lib/theme.ts";
import { describeSkill, modelChips, skillChips } from "@/ui/lib/usageRows.ts";

const catalog: Asset[] = [
  {
    _tag: "Skill",
    source: "agents",
    name: "basecamp",
    description: "Project management",
  },
];

describe("usageRows", () => {
  test("a plugin skill is described by its catalog entry", () => {
    expect(describeSkill(catalog, "basecamp:basecamp")).toBe(
      "Project management",
    );
    expect(describeSkill(catalog, "unknown")).toBeUndefined();
  });

  test("skill chips show how often, with the description on the card", () => {
    const chips = skillChips(
      [{ name: "basecamp", count: 3, first: 1, last: 9, via: ["tool"] }],
      catalog,
    );
    expect(chips[0]).toMatchObject({ label: "basecamp", detail: "×3" });
    expect(chips[0]?.card.subtitle).toBe("Project management");
  });

  test("model chips are tinted by provider", () => {
    const [a, b] = modelChips(
      [
        {
          model: "claude-sonnet-5-5",
          provider: "anthropic",
          turns: 2,
          output: 5,
          first: 0,
          last: 1,
        },
        {
          model: "gpt-oss:20b",
          provider: "ollama",
          turns: 1,
          output: 5,
          first: 0,
          last: 1,
        },
      ],
      themeDark,
    );
    expect(a?.detail).toBe("2 turns");
    expect(b?.detail).toBe("1 turn");
    expect(a?.color).not.toBe(b?.color);
  });
});
