import { Effect, FileSystem, Layer, type Schedule, Stream } from "effect";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import { locateTranscript } from "@/adapters/claude/locate.ts";
import { arr, type Json, parseJson, rec, str } from "@/adapters/shared/json.ts";
import { startOf } from "@/adapters/shared/origin.ts";
import { planItems, statusOf } from "@/adapters/shared/planText.ts";
import { tail } from "@/adapters/shared/tail.ts";
import { taskLists } from "@/adapters/shared/taskLists.ts";
import { AgentId } from "@/domain/ids.ts";
import type { Task } from "@/domain/task.ts";
import { SourceError } from "@/ports/SourceError.ts";
import { TaskRepository } from "@/ports/TaskRepository.ts";

const ROOT = AgentId("main");

// The root agent's task lists: an approved plan, TodoWrite, and the prompts waiting in the queue.
export const makeTaskDecoder = (origin: number) => {
  const lists = taskLists(ROOT);
  // Prompts typed while the agent was busy; hand-backs from sub-agents are not shown.
  let queued: { title: string; shown: boolean }[] = [];

  const queue = (line: Json, at: number) => {
    const op = str(line.operation);
    const content = str(line.content) ?? "";
    if (op === "enqueue") {
      const title = content.split("\n")[0]?.slice(0, 70) ?? "";
      queued = [...queued, { title, shown: !content.startsWith("<") }];
    } else if (op === "dequeue") queued = queued.slice(1);
    else if (op === "remove") queued = queued.slice(0, -1);
    else if (op === "popAll") queued = [];
    else return undefined;
    const items = queued
      .filter((q) => q.shown)
      .map((q) => ({ title: q.title, status: "next" as const }));
    return lists.set("queue", at, items);
  };

  const toolUse = (block: Json, at: number) => {
    const input = rec(block.input);
    if (block.name === "ExitPlanMode") {
      return lists.set("plan", at, planItems(str(input?.plan) ?? ""));
    }
    if (block.name === "TodoWrite") {
      const items = arr(input?.todos).flatMap((t) => {
        const title = str(rec(t)?.content);
        return title ? [{ title, status: statusOf(rec(t)?.status) }] : [];
      });
      return lists.set("todo", at, items);
    }
    return undefined;
  };

  // The whole list when this line changed it.
  return (raw: unknown): readonly Task[] | undefined => {
    const line = rec(raw);
    const ts = Date.parse(str(line?.timestamp) ?? "");
    if (!line || Number.isNaN(ts)) return undefined;
    const at = (ts - origin) / 1000;
    if (line.type === "queue-operation") return queue(line, at);
    if (line.type !== "assistant") return undefined;
    let changed: readonly Task[] | undefined;
    for (const b of arr(rec(line.message)?.content)) {
      const block = rec(b);
      if (block?.type === "tool_use") changed = toolUse(block, at) ?? changed;
    }
    return changed;
  };
};

export const TaskRepositoryFs = (poll: Schedule.Schedule<unknown>) =>
  Layer.effect(
    TaskRepository,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const home = yield* ClaudeHome;
      const tasks = (session: {
        readonly id: Parameters<typeof locateTranscript>[2];
      }) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const { file } = yield* locateTranscript(fs, home, session.id);
            const decode = makeTaskDecoder(yield* startOf(fs, file));
            return tail(file, poll).pipe(
              Stream.flatMap((line) => {
                const next = decode(parseJson(line));
                return next ? Stream.make(next) : Stream.empty;
              }),
            );
          }),
        ).pipe(
          Stream.provideService(FileSystem.FileSystem, fs),
          Stream.mapError((cause) =>
            cause instanceof SourceError
              ? cause
              : new SourceError({ message: "cannot read tasks", cause }),
          ),
        );
      return { tasks };
    }),
  );
