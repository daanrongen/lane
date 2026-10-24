import {
  Effect,
  FileSystem,
  Layer,
  Option,
  type Schedule,
  Stream,
} from "effect";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { makeCodexDecoder } from "@/adapters/codex/decode.ts";
import { locateRollout } from "@/adapters/codex/locate.ts";
import { codexState } from "@/adapters/codex/state.ts";
import { parseJson } from "@/adapters/shared/json.ts";
import { startOf } from "@/adapters/shared/origin.ts";
import { tail } from "@/adapters/shared/tail.ts";
import type { RunEvent } from "@/domain/events.ts";
import { AgentId, SessionId } from "@/domain/ids.ts";
import { RunSource } from "@/ports/RunSource.ts";
import { SourceError } from "@/ports/SourceError.ts";

const ROOT = AgentId("main");
const _text = new TextDecoder();

// `poll` decides the mode: Schedule.once reads a snapshot, a spaced schedule follows live.
export const RunSourceCodex = (poll: Schedule.Schedule<unknown>) =>
  Layer.effect(
    RunSource,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const home = yield* CodexHome;
      const _dir = `${home}/sessions`;

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
            locateRollout(fs, home, SessionId(child.id)).pipe(
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
            const file = yield* locateRollout(fs, home, id);
            const origin = yield* startOf(fs, file);
            return Stream.concat(
              Stream.fromIterable<RunEvent>([
                { _tag: "RunStarted", startedAt: origin },
              ]),
              Stream.mergeAll(
                [rollout(file, origin, { id: ROOT }), children(id, origin)],
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
