import { Effect, FileSystem, Layer, Option } from "effect";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import { parseJson, rec, str } from "@/adapters/shared/json.ts";
import { headLines, tailLines } from "@/adapters/shared/ranges.ts";
import { ThreadId } from "@/domain/ids.ts";
import type { Thread } from "@/domain/thread.ts";
import { SourceError } from "@/ports/SourceError.ts";
import { ThreadRepository } from "@/ports/ThreadRepository.ts";

export const parseSession = (raw: unknown): Thread | undefined => {
  const r = rec(raw);
  const id = str(r?.threadId);
  const cwd = str(r?.cwd);
  if (!id || !cwd || typeof r?.pid !== "number") return undefined;
  return {
    harness: "claude",
    id: ThreadId(id),
    cwd,
    pid: r.pid,
    status: r.status === "busy" ? "busy" : "idle",
    name: str(r.name),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
  };
};

export const processAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
};

const HEAD = 16_384;
const TAIL = 131_072;
// More than this many sessions would only slow the scan.
const MAX_SESSIONS = 300;

interface Summary {
  readonly cwd?: string;
  readonly title?: string;
}

// The working directory is near the top of a transcript, the latest AI title near the end.
export const summarize = (
  head: readonly string[],
  tail: readonly string[],
): Summary => {
  const cwd = head
    .map((l) => str(rec(parseJson(l))?.cwd))
    .find((c) => c !== undefined);
  const title = tail
    .map((l) => rec(parseJson(l)))
    .findLast((r) => r?.type === "ai-title");
  return { cwd, title: str(title?.aiTitle) };
};

// Every transcript is a session; the registry says which are still running.
// Registry files outlive their process, so liveness is injected.
export const ThreadRepositoryFs = (isAlive: (pid: number) => boolean) =>
  Layer.effect(
    ThreadRepository,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const home = yield* ClaudeHome;
      // A transcript is only re-read when it has changed.
      const cache = new Map<string, { mtime: number; summary: Summary }>();

      const summaryOf = (file: string, mtime: number, size: number) =>
        Effect.gen(function* () {
          const hit = cache.get(file);
          if (hit?.mtime === mtime) return hit.summary;
          const summary = summarize(
            yield* headLines(fs, file, HEAD),
            yield* tailLines(fs, file, size, TAIL),
          );
          cache.set(file, { mtime, summary });
          return summary;
        });

      const transcripts = Effect.gen(function* () {
        const root = `${home}/projects`;
        const files = yield* Effect.forEach(
          yield* fs.readDirectory(root),
          (slug) =>
            fs.readDirectory(`${root}/${slug}`).pipe(
              Effect.map((names) =>
                names
                  .filter((n) => n.endsWith(".jsonl"))
                  .map((n) => `${root}/${slug}/${n}`),
              ),
              Effect.orElseSucceed((): string[] => []),
            ),
        );
        const stats = yield* Effect.forEach(
          files.flat(),
          (file) =>
            fs.stat(file).pipe(
              Effect.map((info) => ({
                file,
                size: Number(info.size),
                mtime: Option.getOrElse(
                  info.mtime,
                  () => new Date(0),
                ).getTime(),
              })),
              Effect.orElseSucceed(() => undefined),
            ),
          { concurrency: 16 },
        );
        const newest = stats
          .filter((x) => x !== undefined)
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, MAX_SESSIONS);
        const found = yield* Effect.forEach(
          newest,
          ({ file, mtime, size }) =>
            summaryOf(file, mtime, size).pipe(
              Effect.map(({ cwd, title }): Thread | undefined =>
                cwd
                  ? {
                      harness: "claude",
                      id: ThreadId(
                        file.slice(file.lastIndexOf("/") + 1, -".jsonl".length),
                      ),
                      cwd,
                      status: "past",
                      name: title,
                      updatedAt: mtime,
                    }
                  : undefined,
              ),
              Effect.orElseSucceed(() => undefined),
            ),
          { concurrency: 8 },
        );
        return found.filter((s): s is Thread => s !== undefined);
      }).pipe(Effect.orElseSucceed((): Thread[] => []));

      const running = Effect.gen(function* () {
        const dir = `${home}/sessions`;
        const names = (yield* fs.readDirectory(dir)).filter((f) =>
          f.endsWith(".json"),
        );
        const all = yield* Effect.forEach(names, (f) =>
          fs.readFileString(`${dir}/${f}`).pipe(
            Effect.map((s) => parseSession(parseJson(s))),
            Effect.orElseSucceed(() => undefined),
          ),
        );
        return all.filter(
          (s): s is Thread => s?.pid !== undefined && isAlive(s.pid),
        );
      }).pipe(Effect.orElseSucceed((): Thread[] => []));

      const list = Effect.gen(function* () {
        const [past, live] = yield* Effect.all([transcripts, running]);
        const liveById = new Map(live.map((s) => [s.id, s]));
        const merged = past.map((s) => {
          const l = liveById.get(s.id);
          liveById.delete(s.id);
          return l ? { ...l, name: l.name ?? s.name, cwd: s.cwd } : s;
        });
        // A running session may not have written a transcript yet.
        return [...merged, ...liveById.values()];
      }).pipe(
        Effect.mapError(
          (cause) =>
            new SourceError({ message: "cannot list sessions", cause }),
        ),
      );

      return { list };
    }),
  );
