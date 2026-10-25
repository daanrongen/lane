import { Database } from "bun:sqlite";
import { Effect, FileSystem } from "effect";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";

export interface ThreadRow {
  readonly id: string;
  readonly title: string;
  readonly cwd: string;
  readonly provider: string;
  readonly updatedAt: number;
}

export interface Goal {
  readonly objective: string;
  readonly status: string;
}

export interface Child {
  readonly id: string;
  readonly status: string;
}

export interface CodexState {
  readonly threads: Effect.Effect<readonly ThreadRow[]>;
  readonly goals: (thread: string) => Effect.Effect<readonly Goal[]>;
  readonly queue: (thread: string) => Effect.Effect<readonly string[]>;
  readonly children: (thread: string) => Effect.Effect<readonly Child[]>;
}

const version = (name: string) =>
  Number(/_(\d+)\.sqlite$/.exec(name)?.[1] ?? 0);

// Codex's SQLite files carry a schema version in the name (`state_5.sqlite`); the newest wins.
export const codexState = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const home = yield* CodexHome;

  const query = <Row>(prefix: string, sql: string, ...params: string[]) =>
    Effect.gen(function* () {
      const names = yield* fs.readDirectory(home);
      const file = names
        .filter((n) => new RegExp(`^${prefix}_\\d+\\.sqlite$`).test(n))
        .sort((a, b) => version(b) - version(a))[0];
      if (!file) return [] as Row[];
      const db = new Database(`${home}/${file}`, { readonly: true });
      try {
        return db.query(sql).all(...params) as Row[];
      } finally {
        db.close();
      }
    }).pipe(Effect.orElseSucceed((): Row[] => []));

  const state: CodexState = {
    threads: query<{
      id: string;
      title: string;
      cwd: string;
      model_provider: string;
      updated_at: number;
    }>(
      "state",
      "select id, title, cwd, model_provider, updated_at from threads",
    ).pipe(
      Effect.map((rows) =>
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          cwd: r.cwd,
          provider: r.model_provider,
          updatedAt: r.updated_at * 1000,
        })),
      ),
    ),
    goals: (thread) =>
      query<Goal>(
        "goals",
        "select objective, status from thread_goals where thread_id = ? order by created_at_ms",
        thread,
      ),
    queue: (thread) =>
      query<{ payload_json: string }>(
        "queue",
        "select payload_json from queued_items where thread_id = ? order by queue_order",
        thread,
      ).pipe(Effect.map((rows) => rows.map((r) => r.payload_json))),
    children: (thread) =>
      query<{ child_thread_id: string; status: string }>(
        "state",
        "select child_thread_id, status from thread_spawn_edges where parent_thread_id = ?",
        thread,
      ).pipe(
        Effect.map((rows) =>
          rows.map((r) => ({ id: r.child_thread_id, status: r.status })),
        ),
      ),
  };
  return state;
});
