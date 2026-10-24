import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Effect, FileSystem, Layer } from "effect";
import { jsonl, runFs } from "@/adapters/claude/fixtures.ts";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { meta } from "@/adapters/codex/fixtures.ts";
import {
  parseMeta,
  SessionRepositoryCodex,
} from "@/adapters/codex/sessions.ts";
import { SessionId } from "@/domain/ids.ts";
import { SessionRepository } from "@/ports/SessionRepository.ts";

const list = (home: string) =>
  SessionRepository.use((c) => c.list).pipe(
    Effect.provide(
      SessionRepositoryCodex.pipe(Layer.provide(CodexHome.layer(home))),
    ),
  );

describe("parseMeta", () => {
  test("reads the id and working directory", () => {
    expect(parseMeta(meta(0, "abc", "/p"))).toEqual({
      id: SessionId("abc"),
      cwd: "/p",
    });
    expect(parseMeta({ type: "other" })).toBeUndefined();
  });
});

describe("SessionRepositoryCodex", () => {
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

  test("no sessions directory means no sessions", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        expect(yield* list(home)).toEqual([]);
      }),
    ));
});
