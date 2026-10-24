import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Effect, FileSystem, Layer, Schedule, Stream } from "effect";
import { jsonl, runFs } from "@/adapters/claude/fixtures.ts";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import {
  call,
  finished,
  iso,
  meta,
  output,
  started,
  tokens,
} from "@/adapters/codex/fixtures.ts";
import { RunSourceCodex } from "@/adapters/codex/runs.ts";
import { foldAll } from "@/domain/fold.ts";
import { SessionId } from "@/domain/ids.ts";
import { emptyRun } from "@/domain/run.ts";
import { timeline } from "@/domain/timeline.ts";
import { RunSource } from "@/ports/RunSource.ts";

const SID = SessionId("sess-1");

describe("RunSourceCodex", () => {
  test("reads a rollout into a one-lane timeline", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        const dir = `${home}/sessions/2026/01/01`;
        yield* fs.makeDirectory(dir, { recursive: true });
        yield* fs.writeFileString(
          `${dir}/rollout-2026-01-01T00-00-00-${SID}.jsonl`,
          jsonl([
            meta(0, SID),
            started(0),
            call(1, "c1", "shell", { command: ["ls"] }),
            output(2, "c1", "ok"),
            tokens(3, 1000, 0, 10),
            finished(4),
          ]),
        );

        const events = yield* RunSource.use((s) =>
          Stream.runCollect(s.events(SID)),
        ).pipe(
          Effect.provide(
            RunSourceCodex(Schedule.once).pipe(
              Layer.provide(CodexHome.layer(home)),
            ),
          ),
        );
        const run = foldAll(emptyRun(SID, 0), events);
        const tl = timeline(run, 0);
        expect(
          tl.lanes.map((l) => [l.agent.name, l.bars.length, l.finished]),
        ).toEqual([["codex", 1, true]]);
        expect(run.startedAt).toBe(Date.parse(iso(0)));
        expect(tl.usage.input).toBe(1000);
      }),
    ));

  test("an unknown session fails with SourceError", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        yield* fs.makeDirectory(`${home}/sessions`, { recursive: true });
        const error = yield* RunSource.use((s) =>
          Stream.runCollect(s.events(SessionId("nope"))),
        ).pipe(
          Effect.provide(
            RunSourceCodex(Schedule.once).pipe(
              Layer.provide(CodexHome.layer(home)),
            ),
          ),
          Effect.flip,
        );
        expect(error._tag).toBe("SourceError");
      }),
    ));

  test("spawned threads become lanes", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        const dir = `${home}/sessions/2026/01/01`;
        yield* fs.makeDirectory(dir, { recursive: true });
        yield* fs.writeFileString(
          `${dir}/rollout-t-${SID}.jsonl`,
          jsonl([meta(0, SID), started(0), finished(4)]),
        );
        yield* fs.writeFileString(
          `${dir}/rollout-t-kid.jsonl`,
          jsonl([
            meta(1, "kid"),
            started(1),
            call(2, "c1", "shell", { command: ["ls"] }),
            output(3, "c1", "ok"),
            finished(4),
          ]),
        );

        const state = new Database(`${home}/state_5.sqlite`);
        state.run(
          "create table thread_spawn_edges (parent_thread_id text, child_thread_id text, status text)",
        );
        state.run(
          `insert into thread_spawn_edges values ('${SID}', 'kid', 'running')`,
        );
        state.close();

        const events = yield* RunSource.use((r) =>
          Stream.runCollect(r.events(SID)),
        ).pipe(
          Effect.provide(
            RunSourceCodex(Schedule.once).pipe(
              Layer.provide(CodexHome.layer(home)),
            ),
          ),
        );
        const run = foldAll(emptyRun(SID, 0), events);
        expect(
          timeline(run, 0).lanes.map((l) => [String(l.agent.id), l.depth]),
        ).toEqual([
          ["main", 0],
          ["kid", 1],
        ]);
      }),
    ));
});
