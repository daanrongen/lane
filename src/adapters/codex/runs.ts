import {
  Clock,
  Effect,
  FileSystem,
  Layer,
  Option,
  type Schedule,
  Stream,
} from "effect";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { makeCodexDecoder } from "@/adapters/codex/decode.ts";
import { codexState } from "@/adapters/codex/state.ts";
import { taskEvents } from "@/adapters/codex/tasks.ts";
import { parseJson, rec, str } from "@/adapters/shared/json.ts";
import { concat, tail } from "@/adapters/shared/tail.ts";
import type { RunEvent } from "@/domain/events.ts";
import { AgentId, SessionId } from "@/domain/ids.ts";
import { RunSource } from "@/ports/RunSource.ts";
import { SourceError } from "@/ports/SourceError.ts";

const ROOT = AgentId("main");
const text = new TextDecoder();

// `poll` decides the mode: Schedule.once reads a snapshot, a spaced schedule follows live.
export const RunSourceCodex = (poll: Schedule.Schedule<unknown>) =>
  Layer.effect(
    RunSource,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const home = yield* CodexHome;
      const dir = `${home}/sessions`;

      const locate = (id: SessionId) =>
        fs.readDirectory(dir, { recursive: true }).pipe(
          Effect.map((files) => files.find((f) => f.endsWith(`-${id}.jsonl`))),
          Effect.flatMap((file) =>
            file
              ? Effect.succeed(`${dir}/${file}`)
              : Effect.fail(
                  new SourceError({ message: `no rollout for ${id}` }),
                ),
          ),
        );

      // Run start is the first timestamp in the rollout.
      const startOf = (file: string) =>
        Effect.gen(function* () {
          const head = concat(
            yield* Stream.runCollect(fs.stream(file, { bytesToRead: 32_768 })),
          );
          for (const line of text.decode(head).split("\n")) {
            const ts = Date.parse(str(rec(parseJson(line))?.timestamp) ?? "");
            if (!Number.isNaN(ts)) return ts;
          }
          return yield* Clock.currentTimeMillis;
        });

      const state = yield* codexState.pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(CodexHome, home),
      );

      // One thread's rollout, from its first line to its end.
      const rollout = (
        file: string,
        origin: number,
        agent: { id: AgentId; parent?: AgentId; name?: string },
      ) => {
        const decoder = makeCodexDecoder({
          origin,
          agentId: agent.id,
          parentId: agent.parent,
          name: agent.name,
        });
        return Stream.concat(
          tail(file, poll).pipe(
            Stream.map((line) => decoder.push(parseJson(line))),
            Stream.flattenIterable,
          ),
          Stream.suspend(() => Stream.fromIterable(decoder.end())),
        );
      };

      // Goals and the queue live in SQLite; a snapshot is news only when it changes.
      const tasks = (id: SessionId, origin: number) => {
        let last = "";
        return Stream.fromSchedule(poll).pipe(
          Stream.mapEffect(() =>
            Effect.gen(function* () {
              const [goals, queue] = yield* Effect.all([
                state.goals(id),
                state.queue(id),
              ]);
              const now = yield* Clock.currentTimeMillis;
              const events = taskEvents(
                ROOT,
                (now - origin) / 1000,
                goals,
                queue,
              );
              const signature = JSON.stringify([goals, queue]);
              if (signature === last) return [];
              last = signature;
              return events;
            }),
          ),
          Stream.flattenIterable,
        );
      };

      // Threads the root spawned run as lanes of their own.
      const children = (id: SessionId, origin: number) =>
        Stream.fromSchedule(poll).pipe(
          Stream.mapEffect(() => state.children(id)),
          Stream.flattenIterable,
          Stream.mapAccum(
            () => new Set<string>(),
            (seen, child) =>
              seen.has(child.id) ? [seen, []] : [seen.add(child.id), [child]],
          ),
          Stream.mapEffect((child) =>
            locate(SessionId(child.id)).pipe(
              Effect.map((file) => ({ child, file })),
              Effect.option,
            ),
          ),
          Stream.flatMap(
            (found) =>
              Option.isSome(found)
                ? rollout(found.value.file, origin, {
                    id: AgentId(found.value.child.id),
                    parent: ROOT,
                    name: "codex",
                  })
                : Stream.empty,
            { concurrency: "unbounded" },
          ),
        );

      const events = (id: SessionId) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const file = yield* locate(id);
            const origin = yield* startOf(file);
            return Stream.concat(
              Stream.fromIterable<RunEvent>([
                { _tag: "RunStarted", startedAt: origin },
              ]),
              Stream.mergeAll(
                [
                  rollout(file, origin, { id: ROOT }),
                  tasks(id, origin),
                  children(id, origin),
                ],
                { concurrency: "unbounded" },
              ),
            );
          }),
        ).pipe(
          Stream.provideService(FileSystem.FileSystem, fs),
          Stream.mapError((cause) =>
            cause instanceof SourceError
              ? cause
              : new SourceError({ message: "cannot read rollout", cause }),
          ),
        );
      return { events };
    }),
  );
