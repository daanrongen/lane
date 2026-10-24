import { type Asset, groupAssets, ofKind } from "@/domain/assets.ts";
import type { Card, Fact } from "@/ui/lib/cards.ts";
import { bytes, clip, plural } from "@/ui/lib/format.ts";

export interface Chip {
  readonly label: string;
  readonly detail: string;
  readonly card: Card;
}

export interface AssetRow {
  readonly title: string;
  readonly chips: readonly Chip[];
}

const LISTED = 8;

// The first few entries, then how many more there are.
const listed = (facts: readonly Fact[]): Fact[] => [
  ...facts.slice(0, LISTED),
  ...(facts.length > LISTED
    ? [["more", String(facts.length - LISTED)] as const]
    : []),
];

const skillChips = (assets: readonly Asset[]): Chip[] =>
  groupAssets(ofKind(assets, "Skill")).map((g) => {
    const skills = ofKind(g.assets, "Skill");
    return {
      label: g.source,
      detail: String(skills.length),
      card: {
        title: `${g.source} skills`,
        subtitle: plural(skills.length, "skill"),
        facts: [],
        list: listed(skills.map((s) => [s.name, clip(s.description, 20)])),
      },
    };
  });

const mcpChips = (assets: readonly Asset[]): Chip[] =>
  groupAssets(ofKind(assets, "Mcp")).map((g) => {
    const servers = ofKind(g.assets, "Mcp");
    return {
      label: g.source,
      detail: String(servers.length),
      card: {
        title: `${g.source} mcp servers`,
        subtitle: "configured, not necessarily running",
        facts: [],
        list: listed(servers.map((s) => [s.name, s.transport])),
      },
    };
  });

const modelChips = (assets: readonly Asset[]): Chip[] =>
  groupAssets(ofKind(assets, "Model")).map((g) => {
    const models = ofKind(g.assets, "Model");
    const total = models.reduce((n, m) => n + m.bytes, 0);
    return {
      label: g.source,
      detail: `${models.length} · ${bytes(total)}`,
      card: {
        title: `${g.source} models`,
        subtitle: "installed",
        facts: [["total", bytes(total)]],
        list: listed(models.map((m) => [m.name, bytes(m.bytes)])),
      },
    };
  });

// Settings, permission rules and plugins of one owner, as one chip.
const configChips = (assets: readonly Asset[]): Chip[] => {
  const owners = [
    ...new Set(
      assets
        .filter((a) => ["Setting", "Rule", "Plugin"].includes(a._tag))
        .map((a) => a.source),
    ),
  ];
  return owners.map((source) => {
    const settings = ofKind(assets, "Setting").filter(
      (s) => s.source === source,
    );
    const rules = ofKind(assets, "Rule").filter((r) => r.source === source);
    const plugins = ofKind(assets, "Plugin").filter((p) => p.source === source);
    const allow = rules.filter((r) => r.effect === "allow").length;
    return {
      label: source,
      detail:
        settings.map((s) => s.value).join(" · ") ||
        `${allow} allow · ${rules.length - allow} deny`,
      card: {
        title: `${source} config`,
        subtitle: "settings and permissions",
        facts: [
          ...settings.map((s): Fact => [s.key, s.value]),
          ["allow", String(allow)],
          ["deny", String(rules.length - allow)],
          ["plugins", String(plugins.length)],
        ],
        list: listed(plugins.map((p) => [p.name, "plugin"])),
      },
    };
  });
};

// Empty rows are left out.
export const assetRows = (assets: readonly Asset[]): AssetRow[] =>
  [
    { title: "CONFIG", chips: configChips(assets) },
    { title: "SKILLS", chips: skillChips(assets) },
    { title: "MCP", chips: mcpChips(assets) },
    { title: "MODELS", chips: modelChips(assets) },
  ].filter((r) => r.chips.length > 0);
