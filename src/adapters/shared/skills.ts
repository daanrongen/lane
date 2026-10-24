import { Effect, type FileSystem } from "effect";
import { frontmatter } from "@/adapters/shared/frontmatter.ts";
import type { Asset } from "@/domain/assets.ts";

// Every `<dir>/<skill>/SKILL.md`; a missing directory just has no skills.
export const readSkills = (
  fs: FileSystem.FileSystem,
  dir: string,
  source: string,
): Effect.Effect<Asset[]> =>
  Effect.gen(function* () {
    const names = yield* fs.readDirectory(dir);
    const found = yield* Effect.forEach(
      names.filter((n) => !n.startsWith(".")),
      (name) =>
        fs.readFileString(`${dir}/${name}/SKILL.md`).pipe(
          Effect.map((text): Asset => {
            const meta = frontmatter(text);
            return {
              _tag: "Skill",
              source,
              name: meta.name ?? name,
              description: meta.description ?? "",
            };
          }),
          Effect.orElseSucceed(() => undefined),
        ),
      { concurrency: 8 },
    );
    return found
      .filter((a): a is Asset => a !== undefined)
      .sort((a, b) =>
        (a as { name: string }).name.localeCompare(
          (b as { name: string }).name,
        ),
      );
  }).pipe(Effect.orElseSucceed((): Asset[] => []));
