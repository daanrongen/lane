import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { readAssets } from "@/app/openAssets.ts";
import { emit } from "@/cli/emit.ts";
import { limitOf } from "@/cli/filters.ts";
import { output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import type { Asset } from "@/domain/assets.ts";
import { resolvePath } from "@/domain/workspace.ts";
import { Assets } from "@/ports/Assets.ts";
import { bytes, clip } from "@/ui/lib/format.ts";

export const KINDS = [
  "Skill",
  "Mcp",
  "Model",
  "Rule",
  "Plugin",
  "Setting",
] as const;

const nameOf = (a: Asset) =>
  a._tag === "Rule" ? a.pattern : a._tag === "Setting" ? a.key : a.name;

const detailOf = (a: Asset) => {
  switch (a._tag) {
    case "Skill":
      return a.description;
    case "Mcp":
      return a.transport;
    case "Model":
      return bytes(a.bytes);
    case "Rule":
      return a.effect;
    case "Setting":
      return a.value;
    case "Plugin":
      return "";
  }
};

export const assetsList = (
  o: { workspace?: string; limit?: string; kind?: string },
  cwd: string,
) =>
  Effect.gen(function* () {
    const readers = yield* Assets;
    const found = yield* readAssets(
      readers,
      o.workspace === undefined ? cwd : resolvePath(cwd, o.workspace),
    );
    const rows = found
      .filter((a) => !o.kind || a._tag.toLowerCase() === o.kind.toLowerCase())
      .slice(0, limitOf(o));
    return table(
      [
        { header: "kind", raw: (a) => a._tag },
        { header: "source", raw: (a) => a.source },
        { header: "name", raw: nameOf },
        { header: "detail", raw: detailOf, show: (a) => clip(detailOf(a), 70) },
      ],
      rows,
    );
  });

export const assets = Command.make(
  "assets",
  {
    ...output,
    workspace: scope.workspace,
    limit: scope.limit,
    kind: Flag.Literals("kind", [
      "skill",
      "mcp",
      "model",
      "rule",
      "plugin",
      "setting",
    ]).pipe(Flag.optional),
  },
  (c) => {
    const o = plain(c);
    return emit(o, assetsList(o, process.cwd()));
  },
).pipe(
  Command.withDescription(
    "What the machine and a project have set up for agents: skills, MCP servers, models, rules, plugins, settings",
  ),
);
