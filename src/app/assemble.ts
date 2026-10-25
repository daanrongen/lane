import { Effect } from "effect";
import { type Entry, floor, type Proc } from "@/domain/floor.ts";
import type { Found } from "@/domain/presence.ts";
import type { Run } from "@/domain/run.ts";
import type { Runtime } from "@/domain/runtime.ts";
import type { Task } from "@/domain/task.ts";
import type { Thread } from "@/domain/thread.ts";
import type { Workspace } from "@/domain/workspace.ts";

// A followed thread with its run folded so far.
export interface Loaded {
  readonly thread: Thread;
  readonly run: Run;
  readonly tasks: readonly Task[];
}

// Every loaded thread and the processes no thread explains, as one floor at `at` (epoch ms).
export const assemble = (
  workspaceOf: (cwd: string) => Effect.Effect<Workspace>,
  runtimes: Effect.Effect<readonly Runtime[]>,
  at: number,
  loaded: readonly Loaded[],
  orphans: readonly Found[],
) =>
  Effect.gen(function* () {
    const entries: Entry[] = [];
    for (const l of loaded) {
      // Nothing is known until the first events are read.
      if (l.run.startedAt === 0) continue;
      entries.push({ ...l, workspace: yield* workspaceOf(l.thread.cwd) });
    }
    const alone = yield* Effect.forEach(orphans, (p) =>
      workspaceOf(p.cwd ?? "/").pipe(
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
    return floor(at, entries, alone, yield* runtimes);
  });
