import { Clock, Effect, type FileSystem, Option, Stream } from "effect";
import { parseJson, rec, str } from "@/adapters/shared/json.ts";

// A run starts at the first timestamp in its transcript.
export const startOf = (fs: FileSystem.FileSystem, file: string) =>
  fs.stream(file).pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.map((line) =>
      Date.parse(str(rec(parseJson(line))?.timestamp) ?? ""),
    ),
    Stream.filter((ts) => !Number.isNaN(ts)),
    Stream.runHead,
    Effect.flatMap(
      Option.match({
        onNone: () => Clock.currentTimeMillis,
        onSome: Effect.succeed,
      }),
    ),
  );
