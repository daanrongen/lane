import { describe, expect, test } from "bun:test";
import { Effect, FileSystem, Layer } from "effect";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import { runFs } from "@/adapters/claude/fixtures.ts";
import {
  parseSession,
  summarize,
  ThreadRepositoryFs,
} from "@/adapters/claude/ThreadRepositoryFs.ts";
import { ThreadId } from "@/domain/ids.ts";
import { ThreadRepository } from "@/ports/ThreadRepository.ts";

const entry = (pid: number, extra = {}) =>
  JSON.stringify({
    pid,
    threadId: `s${pid}`,
    cwd: "/x",
    status: "busy",
    updatedAt: 5,
    ...extra,
  });

describe("parseSession", () => {
  test("maps the registry file", () => {
    expect(parseSession(JSON.parse(entry(1, { name: "n" })))).toEqual({
      harness: "claude",
      id: ThreadId("s1"),
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

describe("ThreadRepositoryFs", () => {
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

        const catalog = ThreadRepositoryFs((pid) => pid === 1).pipe(
          Layer.provide(ClaudeHome.layer(home)),
        );
        const sessions = yield* ThreadRepository.use((c) => c.list).pipe(
          Effect.provide(catalog),
        );
        expect(sessions.map((s) => s.id)).toEqual([ThreadId("s1")]);
      }),
    ));
});

describe("summarize", () => {
  test("takes the cwd from the head and the last ai-title from the tail", () => {
    const head = [JSON.stringify({ type: "x" }), JSON.stringify({ cwd: "/p" })];
    const tail = [
      JSON.stringify({ type: "ai-title", aiTitle: "old" }),
      JSON.stringify({ type: "ai-title", aiTitle: "new" }),
    ];
    expect(summarize(head, tail)).toEqual({ cwd: "/p", title: "new" });
    expect(summarize([], [])).toEqual({ cwd: undefined, title: undefined });
  });
});

describe("ThreadRepositoryFs history", () => {
  const run = (home: string, alive: (pid: number) => boolean) =>
    ThreadRepository.use((c) => c.list).pipe(
      Effect.provide(
        ThreadRepositoryFs(alive).pipe(Layer.provide(ClaudeHome.layer(home))),
      ),
    );

  test("every transcript is a session, running ones are marked", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        yield* fs.makeDirectory(`${home}/projects/-x`, { recursive: true });
        yield* fs.makeDirectory(`${home}/sessions`, { recursive: true });
        const lines = (title: string) =>
          `${JSON.stringify({ type: "user", cwd: "/x", threadId: "s" })}\n${JSON.stringify({ type: "ai-title", aiTitle: title })}\n`;
        yield* fs.writeFileString(
          `${home}/projects/-x/s1.jsonl`,
          lines("past one"),
        );
        yield* fs.writeFileString(
          `${home}/projects/-x/s7.jsonl`,
          lines("live one"),
        );
        yield* fs.writeFileString(
          `${home}/sessions/7.json`,
          entry(7, { threadId: "s7", cwd: "/x" }),
        );

        const sessions = yield* run(home, (pid) => pid === 7);
        const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
        expect(byId.s1).toMatchObject({
          status: "past",
          name: "past one",
          cwd: "/x",
        });
        expect(byId.s7).toMatchObject({
          status: "busy",
          pid: 7,
          name: "live one",
        });
      }),
    ));
});
