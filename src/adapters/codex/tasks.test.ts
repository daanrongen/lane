import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Effect, FileSystem, Layer, Schedule, Stream } from "effect";
import { jsonl, runFs } from "@/adapters/claude/fixtures.ts";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import {
  call,
  finished,
  meta,
  origin,
  started,
} from "@/adapters/codex/fixtures.ts";
import {
  goalStatus,
  makeTaskDecoder,
  payloadTitle,
  TaskRepositoryCodex,
} from "@/adapters/codex/tasks.ts";
import { SessionId } from "@/domain/ids.ts";
import type { Session } from "@/domain/session.ts";
import { TaskRepository } from "@/ports/TaskRepository.ts";

describe("codex task helpers", () => {
  test("goal statuses map onto next, doing and done", () => {
    expect(
      ["active", "pursuing", "complete", "achieved", "paused"].map(goalStatus),
    ).toEqual(["doing", "doing", "done", "done", "next"]);
  });

  test("a queued item's text is found wherever its payload keeps it", () => {
    expect(payloadTitle('{"text":"fix the build\\nplease"}')).toBe(
      "fix the build",
    );
    expect(payloadTitle('{"content":[{"type":"text","text":"hello"}]}')).toBe(
      "hello",
    );
    expect(payloadTitle("plain")).toBe("plain");
  });
});

describe("codex task decoder", () => {
  test("update_plan is the todo list, and items keep when they reached their status", () => {
    const decode = makeTaskDecoder(origin);
    const first = decode.line(
      call(1, "c1", "update_plan", {
        plan: [
          { step: "a", status: "in_progress" },
          { step: "b", status: "pending" },
        ],
      }),
    );
    const second = decode.line(
      call(5, "c2", "update_plan", {
        plan: [
          { step: "a", status: "completed" },
          { step: "b", status: "pending" },
        ],
      }),
    );
    expect(first?.map((t) => [t.title, t.status, t.since])).toEqual([
      ["a", "doing", 1],
      ["b", "next", 1],
    ]);
    expect(second?.map((t) => [t.title, t.status, t.since])).toEqual([
      ["a", "done", 5],
      ["b", "next", 1],
    ]);
  });

  test("a line that changes nothing yields nothing", () => {
    const decode = makeTaskDecoder(origin);
    expect(decode.line(started(0))).toBeUndefined();
    expect(decode.line("junk")).toBeUndefined();
  });
});

describe("TaskRepositoryCodex", () => {
  test("goals and the queue from SQLite, and update_plan from the rollout, make one list", () =>
    runFs(
      Effect.gen(function* () {
        const SID = SessionId("s1");
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        const dir = `${home}/sessions/2026/01/01`;
        yield* fs.makeDirectory(dir, { recursive: true });
        yield* fs.writeFileString(
          `${dir}/rollout-t-${SID}.jsonl`,
          jsonl([
            meta(0, SID),
            started(0),
            call(1, "c1", "update_plan", {
              plan: [{ step: "write", status: "pending" }],
            }),
            finished(4),
          ]),
        );
        const goals = new Database(`${home}/goals_1.sqlite`);
        goals.run(
          "create table thread_goals (thread_id text, objective text, status text, created_at_ms integer)",
        );
        goals.run(
          `insert into thread_goals values ('${SID}', 'ship it', 'active', 1)`,
        );
        goals.close();
        const queue = new Database(`${home}/queue_1.sqlite`);
        queue.run(
          "create table queued_items (thread_id text, payload_json text, queue_order integer)",
        );
        queue.run(
          `insert into queued_items values ('${SID}', '{"text":"then deploy"}', 1)`,
        );
        queue.close();

        const session = {
          harness: "codex",
          id: SID,
          cwd: "/x",
          status: "past",
          updatedAt: 0,
        } as Session;
        const lists = yield* TaskRepository.use((r) =>
          Stream.runCollect(r.tasks(session)),
        ).pipe(
          Effect.provide(
            TaskRepositoryCodex(Schedule.once).pipe(
              Layer.provide(CodexHome.layer(home)),
            ),
          ),
        );
        const last = [...lists].at(-1) ?? [];
        expect(last.map((t) => [t.source, t.title, t.status]).sort()).toEqual([
          ["goal", "ship it", "doing"],
          ["queue", "then deploy", "next"],
          ["todo", "write", "next"],
        ]);
      }),
    ));
});
