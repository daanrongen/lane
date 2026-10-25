import { isDeepStrictEqual } from "node:util";
import {
  Clock,
  Context,
  Effect,
  Exit,
  Layer,
  Schedule,
  Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import { type OpenRun, openRun } from "@/app/openRun.ts";
import { SessionsStore } from "@/app/SessionsStore.ts";
import type { Asset } from "@/domain/assets.ts";
import { type Entry, type Floor, floor, type Proc } from "@/domain/floor.ts";
import { find, MATCHERS, presence } from "@/domain/presence.ts";
import type { HarnessProfile } from "@/domain/profile.ts";
import type { Thread } from "@/domain/thread.ts";
import { Assets } from "@/ports/Assets.ts";
import { Harnesses } from "@/ports/Harness.ts";
import { ProcessProbe } from "@/ports/ProcessProbe.ts";
import { Runtimes } from "@/ports/Runtimes.ts";
import { Workspaces } from "@/ports/Workspaces.ts";

export interface FleetOptions {
  readonly tick: Schedule.Schedule<unknown>;
  // A thread quiet for longer than this (ms) leaves the floor unless a process backs it.
  readonly recent: number;
  // The most threads followed at once.
  readonly cap: number;
  // How often processes are listed (ms).
  readonly processEvery: number;
  readonly setupRefresh: Schedule.Schedule<unknown>;
  // Profiles of sources that are not harnesses, like process-only Ollama.
  readonly profiles: readonly HarnessProfile[];
}

const DEFAULTS: FleetOptions = {
  tick: Schedule.spaced("500 millis"),
  recent: 900_000,
  cap: 24,
  processEvery: 3_000,
  setupRefresh: Schedule.spaced("10 seconds"),
  profiles: [],
};

export class Fleet extends Context.Service<
  Fleet,
  {
    readonly floor: SubscriptionRef.SubscriptionRef<Floor>;
    // What each workspace has set up for its agents, by workspace root.
    readonly setups: SubscriptionRef.SubscriptionRef<
      Readonly<Record<string, readonly Asset[]>>
    >;
    readonly profiles: readonly HarnessProfile[];
  }
>()("Fleet") {}

const keyOf = (t: Thread) => `${t.harness}:${t.id}`;

// Live threads first, then the freshest; only so many.
export const pick = (
  threads: readonly Thread[],
  at: number,
  opts: Pick<FleetOptions, "recent" | "cap">,
) =>
  threads
    .filter((t) => t.status !== "past" || at - t.updatedAt < opts.recent)
    .sort(
      (a, b) =>
        Number(b.status !== "past") - Number(a.status !== "past") ||
        b.updatedAt - a.updatedAt,
    )
    .slice(0, opts.cap);

// Follows the machine's live threads and publishes one picture of all of them.
export const FleetLive = (options: Partial<FleetOptions> = {}) => {
  const opts = { ...DEFAULTS, ...options };
  return Layer.effect(
    Fleet,
    Effect.gen(function* () {
      const { sessions } = yield* SessionsStore;
      const harnesses = yield* Harnesses;
      const readers = yield* Assets;
      const probe = yield* ProcessProbe;
      const spaces = yield* Workspaces;
      const machine = yield* Runtimes;

      const board = yield* SubscriptionRef.make<Floor>(floor(0, []));
      const setups = yield* SubscriptionRef.make<
        Readonly<Record<string, readonly Asset[]>>
      >({});

      // One open run per followed thread, each in a scope of its own.
      const pool = new Map<
        string,
        { scope: Scope.Closeable; opened: OpenRun }
      >();
      yield* Effect.addFinalizer(() =>
        Effect.forEach(
          [...pool.values()],
          (p) => Scope.close(p.scope, Exit.void),
          {
            discard: true,
          },
        ),
      );

      const follow = (tracked: readonly Thread[]) =>
        Effect.gen(function* () {
          const wanted = new Set(tracked.map(keyOf));
          for (const [key, p] of pool) {
            if (wanted.has(key)) continue;
            yield* Scope.close(p.scope, Exit.void);
            pool.delete(key);
          }
          for (const t of tracked) {
            if (pool.has(keyOf(t))) continue;
            const scope = yield* Scope.make();
            const opened = yield* openRun(t).pipe(
              Effect.provideService(Scope.Scope, scope),
              Effect.provideService(Harnesses, harnesses),
            );
            pool.set(keyOf(t), { scope, opened });
          }
        });

      let procs: ReturnType<typeof find> = [];
      let listedAt = Number.NEGATIVE_INFINITY;
      const processes = (at: number) =>
        at - listedAt < opts.processEvery
          ? Effect.succeed(procs)
          : probe.find(MATCHERS.map((m) => m.test)).pipe(
              Effect.map((raw) => find(raw)),
              Effect.tap((found) =>
                Effect.sync(() => {
                  procs = found;
                  listedAt = at;
                }),
              ),
              Effect.orElseSucceed(() => procs),
            );

      const tick = Effect.gen(function* () {
        const at = yield* Clock.currentTimeMillis;
        const merged = presence(
          yield* SubscriptionRef.get(sessions),
          yield* processes(at),
        );
        const tracked = pick(merged.threads, at, opts);
        yield* follow(tracked);

        const entries: Entry[] = [];
        for (const thread of tracked) {
          const opened = pool.get(keyOf(thread))?.opened;
          if (!opened) continue;
          const run = yield* SubscriptionRef.get(opened.run);
          // Nothing is known until the first events are read.
          if (run.startedAt === 0) continue;
          entries.push({
            thread,
            run,
            tasks: yield* SubscriptionRef.get(opened.tasks),
            workspace: yield* spaces.of(thread.cwd),
          });
        }
        const alone = yield* Effect.forEach(merged.orphans, (p) =>
          spaces.of(p.cwd ?? "/").pipe(
            Effect.map(
              (workspace): Proc => ({
                harness: p.harness,
                pid: p.pid,
                command: p.command,
                startedAt: p.startedAt,
                workspace,
              }),
            ),
          ),
        );

        const next = floor(at, entries, alone, yield* machine.list);
        const prev = yield* SubscriptionRef.get(board);
        // `at` moves every tick; only a change in what it shows is published.
        if (!isDeepStrictEqual({ ...next, at: 0 }, { ...prev, at: 0 })) {
          yield* SubscriptionRef.set(board, next);
        }
      });

      yield* Stream.fromSchedule(opts.tick).pipe(
        Stream.runForEach(() => tick.pipe(Effect.exit)),
        Effect.forkScoped,
      );

      const readSetups = Effect.gen(function* () {
        const roots = (yield* SubscriptionRef.get(board)).workspaces.map(
          (w) => w.root,
        );
        const read = yield* Effect.forEach(
          roots,
          (root) =>
            Effect.forEach(
              readers,
              (r) =>
                r
                  .read(root)
                  .pipe(Effect.orElseSucceed((): readonly Asset[] => [])),
              { concurrency: "unbounded" },
            ).pipe(Effect.map((all) => [root, all.flat()] as const)),
          { concurrency: 4 },
        );
        const next = Object.fromEntries(read);
        if (!isDeepStrictEqual(next, yield* SubscriptionRef.get(setups))) {
          yield* SubscriptionRef.set(setups, next);
        }
      });
      yield* Stream.make(undefined).pipe(
        Stream.concat(Stream.fromSchedule(opts.setupRefresh)),
        Stream.runForEach(() => readSetups.pipe(Effect.exit)),
        Effect.forkScoped,
      );

      return {
        floor: board,
        setups,
        profiles: [...harnesses.map((h) => h.profile), ...opts.profiles],
      };
    }),
  );
};
