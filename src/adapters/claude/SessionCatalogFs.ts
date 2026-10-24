import { Effect, FileSystem, Layer } from "effect";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import { parseJson, rec, str } from "@/adapters/claude/json.ts";
import { SessionId } from "@/domain/ids.ts";
import type { Session } from "@/domain/session.ts";
import { SessionCatalog } from "@/ports/SessionCatalog.ts";
import { SourceError } from "@/ports/SourceError.ts";

export const parseSession = (raw: unknown): Session | undefined => {
  const r = rec(raw);
  const id = str(r?.sessionId);
  const cwd = str(r?.cwd);
  if (!id || !cwd || typeof r?.pid !== "number") return undefined;
  return {
    harness: "claude",
    id: SessionId(id),
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

// Registry files outlive their process, so liveness is injected.
export const SessionCatalogFs = (isAlive: (pid: number) => boolean) =>
  Layer.effect(
    SessionCatalog,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const dir = `${yield* ClaudeHome}/sessions`;

      const list = Effect.gen(function* () {
        const files = (yield* fs.readDirectory(dir)).filter((f) =>
          f.endsWith(".json"),
        );
        const sessions = yield* Effect.forEach(files, (f) =>
          fs.readFileString(`${dir}/${f}`).pipe(
            Effect.map((s) => parseSession(parseJson(s))),
            Effect.orElseSucceed(() => undefined),
          ),
        );
        return sessions.filter(
          (s): s is Session => s !== undefined && isAlive(s.pid),
        );
      }).pipe(
        Effect.mapError(
          (cause) =>
            new SourceError({ message: "cannot list sessions", cause }),
        ),
      );

      return { list };
    }),
  );
