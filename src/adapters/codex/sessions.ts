import {
  Clock,
  Duration,
  Effect,
  FileSystem,
  Layer,
  Option,
  Stream,
} from "effect";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { parseJson, rec, str } from "@/adapters/shared/json.ts";
import { concat } from "@/adapters/shared/tail.ts";
import { SessionId } from "@/domain/ids.ts";
import type { Session } from "@/domain/session.ts";
import { SessionCatalog } from "@/ports/SessionCatalog.ts";
import { SourceError } from "@/ports/SourceError.ts";

const text = new TextDecoder();
const DAY = 86_400_000;
// A session written this recently is still being worked on.
const BUSY = 30_000;

// `sessions/YYYY/MM/DD/rollout-<time>-<id>.jsonl`; the day in the path avoids stat-ing old files.
const dayOf = (path: string) => {
  const m = /(\d{4})\/(\d{2})\/(\d{2})\//.exec(path);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : 0;
};

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

// Codex keeps no process registry, so recently written rollouts count as live.
export const SessionCatalogCodex = (recent: Duration.Input) =>
  Layer.effect(
    SessionCatalog,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const dir = `${yield* CodexHome}/sessions`;
      const window = Duration.toMillis(Duration.fromInputUnsafe(recent));

      const head = (file: string) =>
        Stream.runCollect(fs.stream(file, { bytesToRead: 65_536 })).pipe(
          Effect.map((chunks) =>
            parseMeta(
              parseJson(text.decode(concat(chunks)).split("\n")[0] ?? ""),
            ),
          ),
        );

      const describe = (
        file: string,
        now: number,
      ): Effect.Effect<Session | undefined> =>
        Effect.gen(function* () {
          const info = yield* fs.stat(`${dir}/${file}`);
          const mtime = Option.getOrElse(
            info.mtime,
            () => new Date(0),
          ).getTime();
          if (now - mtime > window) return undefined;
          const meta = yield* head(`${dir}/${file}`);
          return meta
            ? ({
                ...meta,
                harness: "codex",
                status: now - mtime < BUSY ? "busy" : "idle",
                updatedAt: mtime,
              } satisfies Session)
            : undefined;
        }).pipe(Effect.orElseSucceed(() => undefined));

      const list = Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const files = (yield* fs.readDirectory(dir, {
          recursive: true,
        })).filter(
          (f) => f.endsWith(".jsonl") && dayOf(f) >= now - window - DAY,
        );
        const found = yield* Effect.forEach(files, (f) => describe(f, now));
        return found.filter((s): s is Session => s !== undefined);
      }).pipe(
        // No sessions directory just means Codex never ran.
        Effect.orElseSucceed(() => [] as readonly Session[]),
        Effect.mapError(
          (cause) =>
            new SourceError({ message: "cannot list codex sessions", cause }),
        ),
      );
      return { list };
    }),
  );
