import { Clock, Effect, Stream } from "effect";
import { assemble, type Loaded } from "@/app/assemble.ts";
import { DEFAULTS, pick } from "@/app/Fleet.ts";
import { lister } from "@/app/SessionsStore.ts";
import { foldAll } from "@/domain/fold.ts";
import type { RawProcess } from "@/domain/presence.ts";
import { find, MATCHERS, presence } from "@/domain/presence.ts";
import { emptyRun } from "@/domain/run.ts";
import type { Thread } from "@/domain/thread.ts";
import { Harnesses } from "@/ports/Harness.ts";
import { ProcessProbe } from "@/ports/ProcessProbe.ts";
import { Runtimes } from "@/ports/Runtimes.ts";
import { SourceError } from "@/ports/SourceError.ts";
import { Workspaces } from "@/ports/Workspaces.ts";

// A session's events folded to the end, with the last state of its task lists.
export const snapshotRun = (thread: Thread) =>
  Effect.gen(function* () {
    const harnesses = yield* Harnesses;
    const source = harnesses.find((h) => h.id === thread.harness);
    if (!source) {
      return yield* new SourceError({
        message: `no ${thread.harness} harness`,
      });
    }
    const events = yield* Stream.runCollect(source.events(thread));
    const lists = yield* Stream.runCollect(source.tasks(thread)).pipe(
      Effect.orElseSucceed((): readonly (readonly never[])[] => []),
    );
    return {
      thread,
      run: foldAll(emptyRun(thread.id, 0), events),
      tasks: [...lists].at(-1) ?? [],
    } satisfies Loaded;
  });

// Every thread of every harness, newest first; a running process brings a quiet thread back to idle.
export const listThreads = (probe = true) =>
  Effect.gen(function* () {
    const harnesses = yield* Harnesses;
    const processes = yield* ProcessProbe;
    const { threads, unreadable } = yield* lister()(
      harnesses.map((h) => ({ id: h.id, list: h.sessions })),
    );
    const raw = probe
      ? yield* processes
          .find(MATCHERS.map((m) => m.test))
          .pipe(Effect.orElseSucceed((): readonly RawProcess[] => []))
      : [];
    return { ...presence(threads, find(raw)), unreadable };
  });

export interface FloorOptions {
  // Every thread instead of the live and recent ones.
  readonly all?: boolean;
  // Follow only these threads.
  readonly only?: readonly Thread[];
  readonly probe?: boolean;
}

// One picture of the machine, as the GUI would draw it at this moment.
export const readFloor = ({ all, only, probe }: FloorOptions = {}) =>
  Effect.gen(function* () {
    const spaces = yield* Workspaces;
    const runtimes = yield* Runtimes;
    const at = yield* Clock.currentTimeMillis;
    const listed = only ? undefined : yield* listThreads(probe);
    const tracked =
      only ??
      pick(
        listed?.threads ?? [],
        at,
        all
          ? { recent: Number.POSITIVE_INFINITY, cap: Number.POSITIVE_INFINITY }
          : DEFAULTS,
      );
    const loaded = (yield* Effect.forEach(
      tracked,
      (t) => snapshotRun(t).pipe(Effect.option),
      { concurrency: 4 },
    )).flatMap((o) => (o._tag === "Some" ? [o.value] : []));
    const floor = {
      ...(yield* assemble(
        spaces.of,
        runtimes.list,
        at,
        loaded,
        listed?.orphans ?? [],
      )),
      unreadable: listed?.unreadable ?? [],
    };
    return { floor, loaded };
  });
