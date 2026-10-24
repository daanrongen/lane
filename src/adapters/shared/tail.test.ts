import { describe, expect, test } from "bun:test";
import { Effect, FileSystem, Schedule, Stream } from "effect";
import { runFs } from "@/adapters/claude/fixtures.ts";
import { tail } from "@/adapters/shared/tail.ts";

const fast = Schedule.spaced("10 millis");

describe("tail", () => {
  test("once reads every complete line and stops", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* fs.makeTempDirectoryScoped();
        yield* fs.writeFileString(`${dir}/a.jsonl`, "one\ntwo\npart");
        const lines = yield* Stream.runCollect(
          tail(`${dir}/a.jsonl`, Schedule.once),
        );
        expect(lines).toEqual(["one", "two"]);
      }),
    ));

  test("following picks up appended lines and finishes partial ones", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* fs.makeTempDirectoryScoped();
        const path = `${dir}/a.jsonl`;
        yield* fs.writeFileString(path, "one\ntw");

        const append = Effect.gen(function* () {
          yield* Effect.sleep("40 millis");
          yield* fs.writeFileString(path, "one\ntwo\nthree\nfo");
          yield* Effect.sleep("40 millis");
          yield* fs.writeFileString(path, "one\ntwo\nthree\nfour\n");
        });

        const [lines] = yield* Effect.all(
          [Stream.runCollect(tail(path, fast).pipe(Stream.take(4))), append],
          { concurrency: 2 },
        );
        expect(lines).toEqual(["one", "two", "three", "four"]);
      }),
    ));

  test("multi-byte text split across polls is not corrupted", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* fs.makeTempDirectoryScoped();
        const path = `${dir}/a.jsonl`;
        const bytes = new TextEncoder().encode("héllo wörld\n");
        yield* fs.writeFile(path, bytes.subarray(0, 2)); // splits the "é"

        const append = Effect.gen(function* () {
          yield* Effect.sleep("40 millis");
          yield* fs.writeFile(path, bytes);
        });
        const [lines] = yield* Effect.all(
          [Stream.runCollect(tail(path, fast).pipe(Stream.take(1))), append],
          { concurrency: 2 },
        );
        expect(lines).toEqual(["héllo wörld"]);
      }),
    ));
});
