import {
  Clock,
  Effect,
  FileSystem,
  Layer,
  type Schedule,
  Stream,
} from "effect";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import {
  type Decoder,
  makeDecoder,
  spawnRegistry,
} from "@/adapters/claude/decode.ts";
import { parseJson, rec, str } from "@/adapters/claude/json.ts";
import { concat, tail } from "@/adapters/claude/tail.ts";
import type { RunEvent } from "@/domain/events.ts";
import { AgentId, type SessionId } from "@/domain/ids.ts";
import { RunSource } from "@/ports/RunSource.ts";
import { SourceError } from "@/ports/SourceError.ts";

const ROOT = AgentId("main");
const META = ".meta.json";
const text = new TextDecoder();

const toSourceError = (cause: unknown) =>
  cause instanceof SourceError
    ? cause
    : new SourceError({ message: "cannot read transcripts", cause });

// `poll` decides the mode: Schedule.once reads a snapshot, a spaced schedule follows live.
export const RunSourceFs = (poll: Schedule.Schedule<unknown>) =>
  Layer.effect(
    RunSource,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const home = yield* ClaudeHome;

      const locate = (id: SessionId) =>
        Effect.gen(function* () {
          const projects = `${home}/projects`;
          for (const slug of yield* fs.readDirectory(projects)) {
            const file = `${projects}/${slug}/${id}.jsonl`;
            if (yield* fs.exists(file)) {
              return { file, subagents: `${projects}/${slug}/${id}/subagents` };
            }
          }
          return yield* Effect.fail(
            new SourceError({ message: `no transcript for ${id}` }),
          );
        });

      // Run start is the first timestamp in the root transcript.
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
            const { file, subagents } = yield* locate(id);
            const origin = yield* startOf(file);
            const registry = spawnRegistry();

            const metas = fs.readDirectory(subagents).pipe(
              Effect.map((names) => names.filter((n) => n.endsWith(META))),
              Effect.orElseSucceed(() => []), // no sub-agents yet
            );
            const agentOf = (meta: string) =>
              meta.slice("agent-".length, -META.length);
            const register = (meta: string) =>
              fs.readFileString(`${subagents}/${meta}`).pipe(
                Effect.map((s) => registry.add(agentOf(meta), parseJson(s))),
                Effect.ignore,
              );

            // Registered up front so a snapshot resolves every spawn.
            yield* Effect.forEach(yield* metas, register);

            const decoded = (path: string, decoder: Decoder) =>
              Stream.concat(
                Stream.merge(
                  tail(path, poll).pipe(
                    Stream.map((line) => decoder.push(parseJson(line))),
                    Stream.flattenIterable,
                  ),
                  Stream.fromSchedule(poll).pipe(
                    Stream.map(() => decoder.settle()),
                    Stream.flattenIterable,
                  ),
                ),
                Stream.suspend(() => Stream.fromIterable(decoder.end())),
              );

            const root = decoded(
              file,
              makeDecoder({
                origin,
                agentId: ROOT,
                self: { id: ROOT, parentId: null, name: "main" },
                spawns: registry.lookup,
              }),
            );

            const children = Stream.fromSchedule(poll).pipe(
              Stream.mapEffect(() => metas),
              Stream.flattenIterable,
              Stream.mapAccum(
                () => new Set<string>(),
                (seen, meta) =>
                  seen.has(meta) ? [seen, []] : [seen.add(meta), [meta]],
              ),
              Stream.mapEffect((meta) => Effect.as(register(meta), meta)),
              Stream.flatMap(
                (meta) =>
                  decoded(
                    `${subagents}/${meta.slice(0, -META.length)}.jsonl`,
                    makeDecoder({
                      origin,
                      agentId: AgentId(agentOf(meta)),
                      spawns: registry.lookup,
                    }),
                  ),
                { concurrency: "unbounded" },
              ),
            );

            return Stream.concat(
              Stream.fromIterable<RunEvent>([
                { _tag: "RunStarted", startedAt: origin },
              ]),
              Stream.merge(root, children),
            );
          }),
        ).pipe(
          Stream.provideService(FileSystem.FileSystem, fs),
          Stream.mapError(toSourceError),
        );

      return { events };
    }),
  );
