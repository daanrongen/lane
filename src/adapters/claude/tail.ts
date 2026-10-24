import { Effect, FileSystem, type Schedule, Stream } from "effect";

const NEWLINE = 0x0a;
const text = new TextDecoder();

export const concat = (chunks: readonly Uint8Array[]) => {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
};

// Complete new lines on each poll; a trailing partial line waits for its newline.
export const tail = (path: string, poll: Schedule.Schedule<unknown>) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      let offset = 0n;

      const read = Effect.gen(function* () {
        // The file may not exist yet (e.g. a sub-agent that just spawned).
        if (!(yield* fs.exists(path))) return [];
        const { size } = yield* fs.stat(path);
        if (size <= offset) return [];
        const bytes = concat(
          yield* Stream.runCollect(
            fs.stream(path, { offset, bytesToRead: size - offset }),
          ),
        );
        const end = bytes.lastIndexOf(NEWLINE) + 1;
        offset += BigInt(end);
        return text.decode(bytes.subarray(0, end)).split("\n").filter(Boolean);
      });

      return Stream.fromSchedule(poll).pipe(
        Stream.mapEffect(() => read),
        Stream.flattenIterable,
      );
    }),
  );
