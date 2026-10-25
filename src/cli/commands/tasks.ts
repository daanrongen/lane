import { Clock, Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import type { Loaded } from "@/app/assemble.ts";
import { listThreads, readFloor, snapshotRun } from "@/app/Snapshot.ts";
import { since, threadShort } from "@/cli/commands/shared.ts";
import { emit } from "@/cli/emit.ts";
import { limitOf, type Scope } from "@/cli/filters.ts";
import { CliError, output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import { pickThread } from "@/cli/select.ts";
import { board } from "@/domain/board.ts";
import type { TaskStatus } from "@/domain/task.ts";
import { resolvePath, within } from "@/domain/workspace.ts";

interface Filter extends Scope {
  readonly all: boolean;
  readonly noProbe: boolean;
  readonly source?: string;
  readonly owner?: string;
}

const OPEN: readonly TaskStatus[] = ["doing", "next"];

export const tasksLs = (arg: string | undefined, o: Filter, cwd: string) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const loaded: readonly Loaded[] = arg
      ? [
          yield* Effect.gen(function* () {
            const { threads } = yield* listThreads(!o.noProbe);
            const picked = pickThread(threads, arg, cwd);
            if (!picked.ok) {
              return yield* new CliError({ message: picked.message, code: 3 });
            }
            return yield* snapshotRun(picked.thread);
          }),
        ]
      : (yield* readFloor({ all: o.all, probe: !o.noProbe })).loaded;

    const status = o.status ?? "open";
    const owner = o.owner?.toLowerCase();
    const root =
      o.workspace === undefined ? undefined : resolvePath(cwd, o.workspace);
    const rows = loaded
      .filter(
        (l) =>
          (!o.harness || l.thread.harness === o.harness) &&
          (!root || within(root, l.thread.cwd)),
      )
      .flatMap((l) => {
        const b = board(l.run, l.tasks);
        return [...b.doing, ...b.next, ...b.done].map((t) => ({
          thread: l.thread,
          owner: l.run.agents.find((a) => a.id === t.owner)?.name ?? t.owner,
          task: t,
          at: l.run.startedAt + t.since * 1000,
        }));
      })
      .filter(
        (r) =>
          (status === "any" ||
            (status === "open"
              ? OPEN.includes(r.task.status)
              : r.task.status === status)) &&
          (!o.source || r.task.source === o.source) &&
          (!owner || r.owner.toLowerCase().includes(owner)),
      )
      .slice(0, limitOf(o));
    return table(
      [
        {
          header: "thread",
          raw: (r) => `${r.thread.harness}:${r.thread.id}`,
          show: (r) => threadShort(r.thread),
        },
        { header: "owner", raw: (r) => r.owner },
        { header: "status", raw: (r) => r.task.status },
        { header: "source", raw: (r) => r.task.source },
        { header: "title", raw: (r) => r.task.title },
        {
          header: "since",
          raw: (r) => r.at,
          show: (r) => since(now, r.at) ?? "",
        },
      ],
      rows,
    );
  });

export const tasksNext = (o: Scope & { all: boolean; noProbe: boolean }) =>
  Effect.gen(function* () {
    const { floor } = yield* readFloor({ all: o.all, probe: !o.noProbe });
    const rows = floor.agents.filter(
      (a) => a.next !== undefined && (!o.harness || a.harness === o.harness),
    );
    return table(
      [
        { header: "agent", raw: (a) => a.ref, show: (a) => a.name },
        { header: "harness", raw: (a) => a.harness },
        { header: "state", raw: (a) => a.state },
        { header: "next", raw: (a) => a.next },
        {
          header: "progress",
          raw: (a) => a.progress,
          show: (a) => `${a.progress.done}/${a.progress.total}`,
        },
      ],
      rows.slice(0, limitOf(o)),
    );
  });

const ls = Command.make(
  "ls",
  {
    ...output,
    ...scope,
    thread: Argument.String("thread").pipe(
      Argument.withDescription("one thread; else every live and recent one"),
      Argument.optional,
    ),
    status: Flag.Literals("status", [
      "open",
      "doing",
      "next",
      "done",
      "any",
    ]).pipe(Flag.withDescription("open is doing and next"), Flag.optional),
    source: Flag.Literals("source", [
      "todo",
      "queue",
      "goal",
      "agent",
      "now",
    ]).pipe(Flag.optional),
    owner: Flag.String("owner").pipe(
      Flag.withDescription("the agent that owns it"),
      Flag.optional,
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, tasksLs(o.thread, o, process.cwd()));
  },
).pipe(
  Command.withDescription(
    "Tasks of one thread, or of every live and recent one, including delegated and running work",
  ),
);

const next = Command.make("next", { ...output, ...scope }, (c) => {
  const o = plain(c);
  return emit(o, tasksNext(o));
}).pipe(Command.withDescription("What each agent picks up next"));

export const tasks = Command.make("tasks").pipe(
  Command.withDescription("What agents are doing and have lined up next"),
  Command.withSubcommands([ls, next]),
);
