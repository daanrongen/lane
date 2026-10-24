import {
  Clock,
  Effect,
  FileSystem,
  Layer,
  type Schedule,
  Stream,
} from "effect";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { makeCodexDecoder } from "@/adapters/codex/decode.ts";
import { parseJson, rec, str } from "@/adapters/shared/json.ts";
import { concat, tail } from "@/adapters/shared/tail.ts";
import type { RunEvent } from "@/domain/events.ts";
import { AgentId, type SessionId } from "@/domain/ids.ts";
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
      const dir = `${yield* CodexHome}/sessions`;

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

      const events = (id: SessionId) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const file = yield* locate(id);
            const origin = yield* startOf(file);
            const decoder = makeCodexDecoder({ origin, agentId: ROOT });
            return Stream.concat(
              Stream.fromIterable<RunEvent>([
                { _tag: "RunStarted", startedAt: origin },
              ]),
              Stream.concat(
                tail(file, poll).pipe(
                  Stream.map((line) => decoder.push(parseJson(line))),
                  Stream.flattenIterable,
                ),
                Stream.suspend(() => Stream.fromIterable(decoder.end())),
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
