// What a machine has set up for its agents, whichever harness or provider owns it.
export type Asset =
  | {
      readonly _tag: "Skill";
      readonly source: string;
      readonly name: string;
      readonly description: string;
    }
  | {
      readonly _tag: "Mcp";
      readonly source: string;
      readonly name: string;
      readonly transport: "stdio" | "http";
    }
  | {
      readonly _tag: "Model";
      readonly source: string;
      readonly name: string;
      readonly bytes: number;
    }
  | {
      readonly _tag: "Rule";
      readonly source: string;
      readonly effect: "allow" | "deny";
      readonly pattern: string;
    }
  | {
      readonly _tag: "Plugin";
      readonly source: string;
      readonly name: string;
    }
  | {
      readonly _tag: "Setting";
      readonly source: string;
      readonly key: string;
      readonly value: string;
    };

export type AssetKind = Asset["_tag"];

export interface AssetGroup {
  readonly kind: AssetKind;
  readonly source: string;
  readonly assets: readonly Asset[];
}

// One group per kind and owner, biggest first.
export const groupAssets = (assets: readonly Asset[]): AssetGroup[] => {
  const groups = new Map<string, Asset[]>();
  for (const a of assets) {
    const key = `${a._tag}:${a.source}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.values()]
    .map((list) => ({
      kind: list[0]?._tag as AssetKind,
      source: list[0]?.source ?? "",
      assets: list,
    }))
    .sort(
      (a, b) =>
        b.assets.length - a.assets.length || a.source.localeCompare(b.source),
    );
};

export const ofKind = <K extends AssetKind>(
  assets: readonly Asset[],
  kind: K,
): Extract<Asset, { _tag: K }>[] =>
  assets.filter((a): a is Extract<Asset, { _tag: K }> => a._tag === kind);
