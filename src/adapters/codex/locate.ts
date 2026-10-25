import { Effect, type FileSystem } from "effect";
import type { ThreadId } from "@/domain/ids.ts";
import { SourceError } from "@/ports/SourceError.ts";

// `sessions/YYYY/MM/DD/rollout-<time>-<id>.jsonl`
export const locateRollout = (
  fs: FileSystem.FileSystem,
  home: string,
  id: ThreadId,
) =>
  fs.readDirectory(`${home}/sessions`, { recursive: true }).pipe(
    Effect.map((files) => files.find((f) => f.endsWith(`-${id}.jsonl`))),
    Effect.flatMap((file) =>
      file
        ? Effect.succeed(`${home}/sessions/${file}`)
        : Effect.fail(new SourceError({ message: `no rollout for ${id}` })),
    ),
  );
