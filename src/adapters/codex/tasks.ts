import {
  Clock,
  Effect,
  FileSystem,
  Layer,
  type Schedule,
  Stream,
} from "effect";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { locateRollout } from "@/adapters/codex/locate.ts";
import { codexState, type Goal } from "@/adapters/codex/state.ts";
import { arr, type Json, parseJson, rec, str } from "@/adapters/shared/json.ts";
import { startOf } from "@/adapters/shared/origin.ts";
import { tail } from "@/adapters/shared/tail.ts";
import { taskLists } from "@/adapters/shared/taskLists.ts";
import { statusOf } from "@/adapters/shared/taskStatus.ts";
import { AgentId } from "@/domain/ids.ts";
import type { Task, TaskStatus } from "@/domain/task.ts";
import type { Thread } from "@/domain/thread.ts";
import { SourceError } from "@/ports/SourceError.ts";
import { TaskRepository } from "@/ports/TaskRepository.ts";

const ROOT = AgentId("main");
const clip = (s: string) => (s.length > 70 ? `${s.slice(0, 69)}…` : s);

export const goalStatus = (raw: string): TaskStatus =>
  /complet|achiev|done/i.test(raw)
    ? "done"
    : /activ|pursu|progress|running/i.test(raw)
      ? "doing"
      : "next";

// A queued item's text, wherever its payload keeps it.
export const payloadTitle = (json: string) => {
  const p = rec(parseJson(json));
  const text =
    str(p?.text) ??
    str(p?.content) ??
    str(p?.message) ??
    arr(p?.content)
      .map((c) => str(rec(c)?.text) ?? "")
      .join(" ");
  return clip((text || json).split("\n")[0] ?? "");
};

const parseArgs = (raw: unknown): Json | undefined => {
  try {
    return rec(JSON.parse(String(raw)));
  } catch {
    return undefined;
  }
};

// Codex's tasks: `update_plan` calls in the rollout, goals and the prompt queue in SQLite.
export const makeTaskDecoder = (origin: number) => {
  const lists = taskLists(ROOT);

  return {
    // The whole list when this rollout line changed it.
    line(raw: unknown): readonly Task[] | undefined {
      const line = rec(raw);
      const p = rec(line?.payload);
      const ts = Date.parse(str(line?.timestamp) ?? "");
      if (line?.type !== "response_item" || !p || Number.isNaN(ts))
        return undefined;
      if (p.type !== "function_call" || p.name !== "update_plan")
        return undefined;
      const items = arr(parseArgs(p.arguments)?.plan).flatMap((step) => {
        const title = str(rec(step)?.step);
        return title ? [{ title, status: statusOf(rec(step)?.status) }] : [];
      });
      return lists.set("todo", (ts - origin) / 1000, items);
    },

    state(at: number, goals: readonly Goal[], queue: readonly string[]) {
      const goal = lists.set(
        "goal",
        at,
        goals.map((g) => ({
          title: clip(g.objective),
          status: goalStatus(g.status),
        })),
      );
      const queued = lists.set(
        "queue",
        at,
        queue.map((q) => ({ title: payloadTitle(q), status: "next" as const })),
      );
      return queued ?? goal;
    },
  };
};

export const TaskRepositoryCodex = (poll: Schedule.Schedule<unknown>) =>
  Layer.effect(
    TaskRepository,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const home = yield* CodexHome;
      const state = yield* codexState.pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(CodexHome, home),
      );

      const tasks = (session: Thread) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const file = yield* locateRollout(fs, home, session.id);
            const origin = yield* startOf(fs, file);
            const decoder = makeTaskDecoder(origin);

            const plans = tail(file, poll).pipe(
              Stream.map((line) => decoder.line(parseJson(line))),
            );
            const stored = Stream.fromSchedule(poll).pipe(
              Stream.mapEffect(() =>
                Effect.gen(function* () {
                  const [goals, queue] = yield* Effect.all([
                    state.goals(session.id),
                    state.queue(session.id),
                  ]);
                  const now = yield* Clock.currentTimeMillis;
                  return decoder.state((now - origin) / 1000, goals, queue);
                }),
              ),
            );
            return Stream.merge(plans, stored).pipe(
              Stream.flatMap((next) =>
                next ? Stream.make(next) : Stream.empty,
              ),
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
