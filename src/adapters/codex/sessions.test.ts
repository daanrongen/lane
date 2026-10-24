import { describe, expect, test } from "bun:test";
import { type Duration, Effect, FileSystem, Layer } from "effect";
import { jsonl, runFs } from "@/adapters/claude/fixtures.ts";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { meta } from "@/adapters/codex/fixtures.ts";
import { parseMeta, SessionCatalogCodex } from "@/adapters/codex/sessions.ts";
import { SessionId } from "@/domain/ids.ts";
import { SessionCatalog } from "@/ports/SessionCatalog.ts";

const today = () => new Date().toISOString().slice(0, 10).replaceAll("-", "/");

const list = (home: string, recent: Duration.Input) =>
  SessionCatalog.use((c) => c.list).pipe(
    Effect.provide(
      SessionCatalogCodex(recent).pipe(Layer.provide(CodexHome.layer(home))),
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

describe("SessionCatalogCodex", () => {
  test("lists recently written rollouts and skips stale ones", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        const dir = `${home}/sessions/${today()}`;
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

        const sessions = yield* list(home, "1 hour");
        expect(sessions.map((s) => [s.id, s.harness, s.cwd])).toEqual([
          [SessionId("fresh"), "codex", "/work"],
        ]);
        expect(sessions[0]?.status).toBe("busy");
      }),
    ));

  test("no sessions directory means no sessions", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        expect(yield* list(home, "1 hour")).toEqual([]);
      }),
    ));
});
