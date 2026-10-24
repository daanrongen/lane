import { Effect, type FileSystem, Stream } from "effect";
import { concat } from "@/adapters/shared/tail.ts";

const text = new TextDecoder();

// The first `bytes` of a file, cut to whole lines at the end.
export const headLines = (
  fs: FileSystem.FileSystem,
  file: string,
  bytes: number,
) =>
  Stream.runCollect(fs.stream(file, { bytesToRead: bytes })).pipe(
    Effect.map((chunks) =>
      text.decode(concat(chunks)).split("\n").slice(0, -1),
    ),
  );

// The last `bytes` of a file, without the partial first line.
export const tailLines = (
  fs: FileSystem.FileSystem,
  file: string,
  size: number,
  bytes: number,
) =>
  Effect.gen(function* () {
    const offset = Math.max(0, size - bytes);
    const chunks = yield* Stream.runCollect(
      fs.stream(file, { offset, bytesToRead: size - offset }),
    );
    const lines = text.decode(concat(chunks)).split("\n");
    return offset > 0 ? lines.slice(1) : lines;
  });
