import { Clock, Effect, type FileSystem, Stream } from "effect";
import { parseJson, rec, str } from "@/adapters/shared/json.ts";
import { concat } from "@/adapters/shared/tail.ts";

const text = new TextDecoder();

// A run starts at the first timestamp in its transcript.
export const startOf = (fs: FileSystem.FileSystem, file: string) =>
  Effect.gen(function* () {
    const head = concat(
      yield* Stream.runCollect(fs.stream(file, { bytesToRead: 32_768 })),
    );
    for (const line of text.decode(head).split("\n")) {
      const ts = Date.parse(str(rec(parseJson(line))?.timestamp) ?? "");
      if (!Number.isNaN(ts)) return ts;
    }
    return yield* Clock.currentTimeMillis;
  });
