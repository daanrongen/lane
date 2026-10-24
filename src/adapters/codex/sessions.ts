import { Clock, Effect, FileSystem, Layer, Option } from "effect";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { codexState } from "@/adapters/codex/state.ts";
import { parseJson, rec, str } from "@/adapters/shared/json.ts";
import { headLines } from "@/adapters/shared/ranges.ts";
import { SessionId } from "@/domain/ids.ts";
import type { Session, SessionStatus } from "@/domain/session.ts";
import { SessionRepository } from "@/ports/SessionRepository.ts";
import { SourceError } from "@/ports/SourceError.ts";

// Codex keeps no process registry, so how recently a rollout was written says if it is live.
const BUSY = 30_000;
const IDLE = 600_000;
// More than this many sessions would only slow the scan.
const MAX_SESSIONS = 300;

const statusOf = (age: number): SessionStatus =>
  age < BUSY ? "busy" : age < IDLE ? "idle" : "past";

export const parseMeta = (
  raw: unknown,
): Pick<Session, "id" | "cwd"> | undefined => {
  const line = rec(raw);
  const p = rec(line?.payload);
  const id = str(p?.id);
  const cwd = str(p?.cwd);
  return line?.type === "session_meta" && id && cwd
    ? { id: SessionId(id), cwd }
    : undefined;
};

// Every rollout under `sessions/YYYY/MM/DD/` is a session; titles come from Codex's own index.
export const SessionRepositoryCodex = Layer.effect(
  SessionRepository,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const home = yield* CodexHome;
    const dir = `${home}/sessions`;
    const state = yield* codexState.pipe(
      Effect.provideService(CodexHome, home),
      Effect.provideService(FileSystem.FileSystem, fs),
    );

    const describe = (
      file: string,
      now: number,
      titles: ReadonlyMap<string, string>,
    ): Effect.Effect<Session | undefined> =>
      Effect.gen(function* () {
        const info = yield* fs.stat(`${dir}/${file}`);
        const mtime = Option.getOrElse(info.mtime, () => new Date(0)).getTime();
        const meta = parseMeta(
          parseJson((yield* headLines(fs, `${dir}/${file}`, 65_536))[0] ?? ""),
        );
        return meta
          ? {
              ...meta,
              harness: "codex" as const,
              status: statusOf(now - mtime),
              name: titles.get(meta.id),
              updatedAt: mtime,
            }
          : undefined;
      }).pipe(Effect.orElseSucceed(() => undefined));

    const list = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const titles = new Map(
        (yield* state.threads).map((t) => [t.id, t.title]),
      );
      // Paths start with the date, so the newest sort last.
      const files = (yield* fs.readDirectory(dir, { recursive: true }))
        .filter((f) => f.endsWith(".jsonl"))
        .sort()
        .slice(-MAX_SESSIONS);
      const found = yield* Effect.forEach(
        files,
        (f) => describe(f, now, titles),
        {
          concurrency: 8,
        },
      );
      return found.filter((s): s is Session => s !== undefined);
    }).pipe(
      // No sessions directory just means Codex never ran.
      Effect.orElseSucceed((): readonly Session[] => []),
      Effect.mapError(
        (cause) =>
          new SourceError({ message: "cannot list codex sessions", cause }),
      ),
    );
    return { list };
  }),
);
