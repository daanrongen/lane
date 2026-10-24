import { describe, expect, test } from "bun:test";
import { Effect, FileSystem, Layer } from "effect";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import { runFs } from "@/adapters/claude/fixtures.ts";
import {
  parseSession,
  SessionCatalogFs,
} from "@/adapters/claude/SessionCatalogFs.ts";
import { SessionId } from "@/domain/ids.ts";
import { SessionCatalog } from "@/ports/SessionCatalog.ts";

const entry = (pid: number, extra = {}) =>
  JSON.stringify({
    pid,
    sessionId: `s${pid}`,
    cwd: "/x",
    status: "busy",
    updatedAt: 5,
    ...extra,
  });

describe("parseSession", () => {
  test("maps the registry file", () => {
    expect(parseSession(JSON.parse(entry(1, { name: "n" })))).toEqual({
      id: SessionId("s1"),
      cwd: "/x",
      pid: 1,
      status: "busy",
      name: "n",
      updatedAt: 5,
    });
  });

  test("unknown status is idle; missing fields are rejected", () => {
    expect(parseSession(JSON.parse(entry(1, { status: "?" })))?.status).toBe(
      "idle",
    );
    expect(parseSession({ pid: 1 })).toBeUndefined();
    expect(parseSession(null)).toBeUndefined();
  });
});

describe("SessionCatalogFs", () => {
  test("lists live sessions and skips dead or malformed entries", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        yield* fs.makeDirectory(`${home}/sessions`);
        yield* fs.writeFileString(`${home}/sessions/1.json`, entry(1));
        yield* fs.writeFileString(`${home}/sessions/2.json`, entry(2));
        yield* fs.writeFileString(`${home}/sessions/3.json`, "{nope");
        yield* fs.writeFileString(`${home}/sessions/1.abc.key`, "secret");

        const catalog = SessionCatalogFs((pid) => pid === 1).pipe(
          Layer.provide(ClaudeHome.layer(home)),
        );
        const sessions = yield* SessionCatalog.use((c) => c.list).pipe(
          Effect.provide(catalog),
        );
        expect(sessions.map((s) => s.id)).toEqual([SessionId("s1")]);
      }),
    ));
});
