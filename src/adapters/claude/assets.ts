import { Effect, FileSystem } from "effect";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import { arr, type Json, parseJson, rec, str } from "@/adapters/shared/json.ts";
import { readSkills } from "@/adapters/shared/skills.ts";
import type { Asset } from "@/domain/assets.ts";
import type { AssetReader } from "@/ports/Assets.ts";

const SOURCE = "claude";

const rules = (source: string, permissions: Json | undefined): Asset[] =>
  (["allow", "deny"] as const).flatMap((effect) =>
    arr(permissions?.[effect]).flatMap((p) =>
      typeof p === "string"
        ? [{ _tag: "Rule", source, effect, pattern: p } as const]
        : [],
    ),
  );

// `settings.json`: permission rules, enabled plugins, model and effort.
export const settingsAssets = (source: string, settings: Json): Asset[] => [
  ...rules(source, rec(settings.permissions)),
  ...Object.entries(rec(settings.enabledPlugins) ?? {})
    .filter(([, on]) => on === true)
    .map(([name]): Asset => ({ _tag: "Plugin", source, name })),
  ...(["model", "effortLevel", "defaultMode"] as const).flatMap((key) => {
    const value = str(settings[key]) ?? str(rec(settings.permissions)?.[key]);
    return value ? [{ _tag: "Setting", source, key, value } as const] : [];
  }),
];

export const mcpAssets = (source: string, servers: Json | undefined): Asset[] =>
  Object.entries(servers ?? {}).map(
    ([name, def]): Asset => ({
      _tag: "Mcp",
      source,
      name,
      transport: rec(def)?.url || rec(def)?.type === "http" ? "http" : "stdio",
    }),
  );

// Global setup plus whatever the project at `cwd` adds.
export const claudeAssets = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const home = yield* ClaudeHome;
  const json = (path: string) =>
    fs.readFileString(path).pipe(
      Effect.map((s) => rec(parseJson(s)) ?? {}),
      Effect.orElseSucceed((): Json => ({})),
    );

  const read = (cwd: string) =>
    Effect.gen(function* () {
      const [user, project, local, mcpFile, claudeJson] = yield* Effect.all([
        json(`${home}/settings.json`),
        json(`${cwd}/.claude/settings.json`),
        json(`${cwd}/.claude/settings.local.json`),
        json(`${cwd}/.mcp.json`),
        json(`${home}.json`),
      ]);
      const projectMcp = rec(rec(rec(claudeJson.projects)?.[cwd])?.mcpServers);
      return [
        ...settingsAssets(SOURCE, user),
        ...settingsAssets("project", project),
        ...settingsAssets("project", local),
        ...mcpAssets(SOURCE, rec(claudeJson.mcpServers)),
        ...mcpAssets("project", { ...projectMcp, ...rec(mcpFile.mcpServers) }),
        ...(yield* readSkills(fs, `${home}/skills`, SOURCE)),
        ...(yield* readSkills(fs, `${cwd}/.claude/skills`, "project")),
      ];
    });
  return { source: SOURCE, read } satisfies AssetReader;
});
