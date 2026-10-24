import { Effect, type FileSystem } from "effect";
import type { SessionId } from "@/domain/ids.ts";
import { SourceError } from "@/ports/SourceError.ts";

// A session's transcript sits in the project folder it ran in, and its sub-agents beside it.
export const locateTranscript = (
  fs: FileSystem.FileSystem,
  home: string,
  id: SessionId,
) =>
  Effect.gen(function* () {
    const projects = `${home}/projects`;
    for (const slug of yield* fs.readDirectory(projects)) {
      const file = `${projects}/${slug}/${id}.jsonl`;
      if (yield* fs.exists(file)) {
        return { file, subagents: `${projects}/${slug}/${id}/subagents` };
      }
    }
    return yield* Effect.fail(
      new SourceError({ message: `no transcript for ${id}` }),
    );
  });
