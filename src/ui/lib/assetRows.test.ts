import { describe, expect, test } from "bun:test";
import type { Asset } from "@/domain/assets.ts";
import { assetRows } from "@/ui/lib/assetRows.ts";

const assets: Asset[] = [
  { _tag: "Skill", source: "agents", name: "mise", description: "tools" },
  { _tag: "Skill", source: "agents", name: "ssh", description: "keys" },
  { _tag: "Skill", source: "codex", name: "mise", description: "tools" },
  { _tag: "Setting", source: "claude", key: "model", value: "sonnet" },
  { _tag: "Rule", source: "claude", effect: "allow", pattern: "WebFetch" },
  { _tag: "Rule", source: "claude", effect: "deny", pattern: "Read(.env)" },
  {
    _tag: "Model",
    source: "ollama",
    name: "granite4:latest",
    bytes: 2_100_000_000,
  },
];

describe("assetRows", () => {
  test("one chip per owner, rows without assets are left out", () => {
    const rows = assetRows(assets);
    expect(rows.map((r) => r.title)).toEqual(["CONFIG", "SKILLS", "MODELS"]);
    expect(rows[1]?.chips.map((c) => [c.label, c.detail])).toEqual([
      ["agents", "2"],
      ["codex", "1"],
    ]);
  });

  test("a config chip shows its settings and counts rules", () => {
    const chip = assetRows(assets)[0]?.chips[0];
    expect(chip?.detail).toBe("sonnet");
    expect(chip?.card.facts).toContainEqual(["allow", "1"]);
    expect(chip?.card.facts).toContainEqual(["deny", "1"]);
  });

  test("a model chip shows count and total size", () => {
    expect(assetRows(assets)[2]?.chips[0]?.detail).toBe("1 · 2.1 GB");
  });

  test("long lists are cut with a count of the rest", () => {
    const many: Asset[] = Array.from({ length: 12 }, (_, i) => ({
      _tag: "Skill",
      source: "agents",
      name: `s${i}`,
      description: "",
    }));
    const list = assetRows(many)[0]?.chips[0]?.card.list ?? [];
    expect(list).toHaveLength(9);
    expect(list.at(-1)).toEqual(["more", "4"]);
  });
});
