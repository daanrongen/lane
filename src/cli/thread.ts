import { Effect } from "effect";
import type { Loaded } from "@/app/assemble.ts";
import { listThreads, readFloor, snapshotRun } from "@/app/Snapshot.ts";
import type { Scope } from "@/cli/filters.ts";
import { CliError } from "@/cli/options.ts";
import { pickThread } from "@/cli/select.ts";
import { resolvePath, within } from "@/domain/workspace.ts";

export interface Reach extends Scope {
  readonly all: boolean;
  readonly noProbe: boolean;
}

// One thread's folded run; no argument means the newest thread here.
export const loadThread = (
  arg: string | undefined,
  o: { noProbe: boolean },
  cwd: string,
) =>
  Effect.gen(function* () {
    const { threads } = yield* listThreads(!o.noProbe);
    const picked = pickThread(threads, arg ?? ".", cwd);
    if (!picked.ok) {
      return yield* new CliError({ message: picked.message, code: 3 });
    }
    return yield* snapshotRun(picked.thread).pipe(
      Effect.mapError(
        () =>
          new CliError({
            message: `cannot read ${picked.thread.harness}:${picked.thread.id}`,
            code: 1,
          }),
      ),
    );
  });

// The named thread, or every live and recent one narrowed by `--harness` and `-w`.
export const loadRuns = (arg: string | undefined, o: Reach, cwd: string) =>
  Effect.gen(function* () {
    if (arg) return [yield* loadThread(arg, o, cwd)] as readonly Loaded[];
    const { loaded } = yield* readFloor({ all: o.all, probe: !o.noProbe });
    const root =
      o.workspace === undefined ? undefined : resolvePath(cwd, o.workspace);
    return loaded.filter(
      (l) =>
        (!o.harness || l.thread.harness === o.harness) &&
        (!root || within(root, l.thread.cwd)),
    );
  });
