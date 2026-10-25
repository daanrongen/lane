import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Effect, FileSystem, Layer } from "effect";
import { jsonl, runFs } from "@/adapters/claude/fixtures.ts";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { meta } from "@/adapters/codex/fixtures.ts";
import { parseMeta, ThreadRepositoryCodex } from "@/adapters/codex/threads.ts";
import { ThreadId } from "@/domain/ids.ts";
import { ThreadRepository } from "@/ports/ThreadRepository.ts";

const list = (home: string) =>
  ThreadRepository.use((c) => c.list).pipe(
    Effect.provide(
      ThreadRepositoryCodex.pipe(Layer.provide(CodexHome.layer(home))),
    ),
  );

describe("parseMeta", () => {
  test("reads the id and working directory", () => {
    expect(parseMeta(meta(0, "abc", "/p"))).toEqual({
      id: ThreadId("abc"),
      cwd: "/p",
    });
    expect(parseMeta({ type: "other" })).toBeUndefined();
  });
});

describe("ThreadRepositoryCodex", () => {
  test("every rollout is a session; age says if it is still live", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        const dir = `${home}/sessions/2026/01/01`;
        yield* fs.makeDirectory(dir, { recursive: true });
        yield* fs.writeFileString(
          `${dir}/rollout-t-fresh.jsonl`,
          jsonl([meta(0, "fresh")]),
        );
        yield* fs.writeFileString(
          `${dir}/rollout-t-stale.jsonl`,
          jsonl([meta(0, "stale")]),
        );
        const old = new Date(Date.now() - 7_200_000);
        yield* fs.utimes(`${dir}/rollout-t-stale.jsonl`, old, old);

        const sessions = yield* list(home);
        const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
        expect(byId.fresh).toMatchObject({
          harness: "codex",
          cwd: "/work",
          status: "busy",
        });
        expect(byId.stale?.status).toBe("past");
      }),
    ));

  test("titles come from Codex's own thread index", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        const dir = `${home}/sessions/2026/01/01`;
        yield* fs.makeDirectory(dir, { recursive: true });
        yield* fs.writeFileString(
          `${dir}/rollout-t-a.jsonl`,
          jsonl([meta(0, "a")]),
        );
        const db = new Database(`${home}/state_5.sqlite`);
        db.run(
          "create table threads (id text, title text, cwd text, model_provider text, updated_at integer)",
        );
        db.run(
          "insert into threads values ('a', 'Fix the build', '/work', 'openai', 5)",
        );
        db.close();

        expect((yield* list(home))[0]?.name).toBe("Fix the build");
      }),
    ));

  test("a thread another one spawned is not listed", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        const dir = `${home}/sessions/2026/01/01`;
        yield* fs.makeDirectory(dir, { recursive: true });
        for (const id of ["parent", "child"]) {
          yield* fs.writeFileString(
            `${dir}/rollout-t-${id}.jsonl`,
            jsonl([meta(0, id)]),
          );
        }
        const db = new Database(`${home}/state_5.sqlite`);
        db.run(
          "create table thread_spawn_edges (parent_thread_id text, child_thread_id text, status text)",
        );
        db.run(
          "insert into thread_spawn_edges values ('parent', 'child', 'open')",
        );
        db.close();

        expect((yield* list(home)).map((t) => t.id)).toEqual([
          ThreadId("parent"),
        ]);
      }),
    ));

  test("no sessions directory means no sessions", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        expect(yield* list(home)).toEqual([]);
      }),
    ));
});
