import { describe, expect, test } from "bun:test";
import { Effect, FileSystem, Layer, Schedule, Stream } from "effect";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import {
  assistant,
  iso,
  jsonl,
  origin,
  runFs,
  toolUse,
} from "@/adapters/claude/fixtures.ts";
import { makeTaskDecoder, TaskRepositoryFs } from "@/adapters/claude/tasks.ts";
import { SessionId } from "@/domain/ids.ts";
import type { Session } from "@/domain/session.ts";
import { TaskRepository } from "@/ports/TaskRepository.ts";

const queue = (s: number, operation: string, content?: string) => ({
  type: "queue-operation",
  operation,
  content,
  timestamp: iso(s),
});

describe("claude task decoder", () => {
  test("an approved plan is not a task list", () => {
    const decode = makeTaskDecoder(origin);
    expect(
      decode(
        assistant(1, "m1", [
          toolUse("t1", "ExitPlanMode", { plan: "## 1. Build\n## 2. Ship" }),
        ]),
      ),
    ).toBeUndefined();
  });

  test("TodoWrite replaces the list; items keep when they reached their status", () => {
    const decode = makeTaskDecoder(origin);
    const todo = (s: number, a: string, b: string) =>
      assistant(s, `m${s}`, [
        toolUse(`t${s}`, "TodoWrite", {
          todos: [
            { content: "write", status: a },
            { content: "test", status: b },
          ],
        }),
      ]);
    decode(todo(1, "in_progress", "pending"));
    const next = decode(todo(6, "completed", "in_progress"));
    expect(next?.map((t) => [t.title, t.status, t.since])).toEqual([
      ["write", "done", 6],
      ["test", "doing", 6],
    ]);
  });

  test("the prompt queue shows typed prompts and ignores sub-agent hand-backs", () => {
    const decode = makeTaskDecoder(origin);
    decode(queue(1, "enqueue", "<agent-message>done"));
    const typed = decode(queue(2, "enqueue", "then do x"));
    expect(typed?.map((t) => [t.source, t.title])).toEqual([
      ["queue", "then do x"],
    ]);
    expect(decode(queue(3, "dequeue"))).toBeUndefined();
    expect(decode(queue(4, "dequeue"))?.map((t) => t.title)).toEqual([]);
  });

  test("lines that change nothing yield nothing", () => {
    const decode = makeTaskDecoder(origin);
    expect(
      decode(assistant(1, "m1", [toolUse("t1", "Bash", {})])),
    ).toBeUndefined();
    expect(decode(null)).toBeUndefined();
  });
});

describe("TaskRepositoryFs", () => {
  test("reads a session's transcript into its task list", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        yield* fs.makeDirectory(`${home}/projects/-p`, { recursive: true });
        yield* fs.writeFileString(
          `${home}/projects/-p/s1.jsonl`,
          jsonl([
            assistant(1, "m1", [
              toolUse("t1", "TodoWrite", {
                todos: [{ content: "go", status: "pending" }],
              }),
            ]),
          ]),
        );
        const session = {
          harness: "claude",
          id: SessionId("s1"),
          cwd: "/p",
          status: "past",
          updatedAt: 0,
        } as Session;
        const lists = yield* TaskRepository.use((r) =>
          Stream.runCollect(r.tasks(session)),
        ).pipe(
          Effect.provide(
            TaskRepositoryFs(Schedule.once).pipe(
              Layer.provide(ClaudeHome.layer(home)),
            ),
          ),
        );
        expect([...lists].at(-1)?.map((t) => t.title)).toEqual(["go"]);
      }),
    ));
});
