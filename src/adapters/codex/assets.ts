import { Effect, FileSystem } from "effect";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { type Json, rec, str } from "@/adapters/shared/json.ts";
import { readSkills } from "@/adapters/shared/skills.ts";
import type { Asset } from "@/domain/assets.ts";
import type { AssetReader } from "@/ports/Assets.ts";

const SOURCE = "codex";

const SETTINGS = [
  "model",
  "model_reasoning_effort",
  "approval_policy",
  "sandbox_mode",
  "personality",
] as const;

// `config.toml`: a few top-level settings and the MCP servers.
export const configAssets = (config: Json): Asset[] => [
  ...SETTINGS.flatMap((key) => {
    const value = str(config[key]);
    return value
      ? [{ _tag: "Setting", source: SOURCE, key, value } as const]
      : [];
  }),
  ...Object.entries(rec(config.mcp_servers) ?? {}).map(
    ([name, def]): Asset => ({
      _tag: "Mcp",
      source: SOURCE,
      name,
      transport: rec(def)?.url ? "http" : "stdio",
    }),
  ),
];

export const codexAssets = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const home = yield* CodexHome;
  const config = fs.readFileString(`${home}/config.toml`).pipe(
    Effect.map((s) => configAssets(Bun.TOML.parse(s) as Json)),
    Effect.orElseSucceed((): Asset[] => []),
  );
  const reader: AssetReader = {
    source: SOURCE,
    read: () =>
      Effect.all([config, readSkills(fs, `${home}/skills`, SOURCE)]).pipe(
        Effect.map((all) => all.flat()),
      ),
  };
  return reader;
});
