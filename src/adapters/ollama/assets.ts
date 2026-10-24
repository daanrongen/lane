import { Effect, FileSystem } from "effect";
import { OllamaHome } from "@/adapters/ollama/OllamaHome.ts";
import { arr, num, parseJson, rec } from "@/adapters/shared/json.ts";
import type { Asset } from "@/domain/assets.ts";
import type { AssetReader } from "@/ports/Assets.ts";

// A manifest at `<registry>/<namespace>/<name>/<tag>` lists the layers that make a model.
export const modelName = (path: string) => {
  const [, namespace, name, tag] = path.split("/");
  if (!namespace || !name || !tag) return undefined;
  return `${namespace === "library" ? "" : `${namespace}/`}${name}:${tag}`;
};

export const manifestBytes = (manifest: unknown) =>
  arr(rec(manifest)?.layers).reduce<number>(
    (n, layer) => n + num(rec(layer)?.size),
    0,
  );

// Installed models; running ones are not on disk.
export const ollamaAssets = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const dir = `${yield* OllamaHome}/models/manifests`;
  const read = () =>
    Effect.gen(function* () {
      const paths = yield* fs.readDirectory(dir, { recursive: true });
      const found = yield* Effect.forEach(paths, (path) => {
        const name = path.split("/").length === 4 ? modelName(path) : undefined;
        return name
          ? fs.readFileString(`${dir}/${path}`).pipe(
              Effect.map(
                (s): Asset => ({
                  _tag: "Model",
                  source: "ollama",
                  name,
                  bytes: manifestBytes(parseJson(s)),
                }),
              ),
              Effect.orElseSucceed(() => undefined),
            )
          : Effect.succeed(undefined);
      });
      return found.filter((a): a is Asset => a !== undefined);
    }).pipe(Effect.orElseSucceed((): Asset[] => []));
  const reader: AssetReader = { source: "ollama", read };
  return reader;
});
