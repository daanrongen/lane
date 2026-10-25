import { Clock, Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { listThreads, readFloor } from "@/app/Snapshot.ts";
import { since, threadKey, threadShort, tilde } from "@/cli/commands/shared.ts";
import { emit } from "@/cli/emit.ts";
import { limitOf, type Scope, threadsWhere } from "@/cli/filters.ts";
import { CliError, output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import { pickThread } from "@/cli/select.ts";
import { modelsUsed } from "@/domain/models.ts";
import { Workspaces } from "@/ports/Workspaces.ts";
import { dollars, duration, modelName, tokens } from "@/ui/lib/format.ts";

const LIMIT = 30;

export const threadsLs = (
  o: Scope & { all: boolean; noProbe: boolean },
  cwd: string,
) =>
  Effect.gen(function* () {
    const spaces = yield* Workspaces;
    const now = yield* Clock.currentTimeMillis;
    const { threads } = yield* listThreads(!o.noProbe);
    const wanted = threadsWhere(threads, o, cwd, now).slice(
      0,
      o.all ? Number.POSITIVE_INFINITY : limitOf(o, LIMIT),
    );
    const rows = yield* Effect.forEach(wanted, (t) =>
      Effect.map(spaces.of(t.cwd), (w) => ({ t, w })),
    );
    return table(
      [
        { header: "harness", raw: (r) => r.t.harness },
        { header: "id", raw: (r) => r.t.id, show: (r) => threadShort(r.t) },
        { header: "status", raw: (r) => r.t.status },
        {
          header: "updated",
          raw: (r) => r.t.updatedAt,
          show: (r) => since(now, r.t.updatedAt) ?? "",
        },
        {
          header: "workspace",
          raw: (r) => r.w.root,
          show: (r) => tilde(r.w.root),
        },
        { header: "branch", raw: (r) => r.w.branch },
        { header: "name", raw: (r) => r.t.name },
      ],
      rows,
    );
  });

export const threadsShow = (
  arg: string | undefined,
  o: { noProbe: boolean },
  cwd: string,
) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const { threads } = yield* listThreads(!o.noProbe);
    const picked = pickThread(threads, arg ?? ".", cwd);
    if (!picked.ok) {
      return yield* new CliError({ message: picked.message, code: 3 });
    }
    const { thread } = picked;
    const { floor, loaded } = yield* readFloor({ only: [thread] });
    const run = loaded[0]?.run;
    if (!run) {
      return yield* new CliError({
        message: `cannot read ${threadKey(thread)}`,
        code: 1,
      });
    }
    const workspace = floor.workspaces[0];
    const models = modelsUsed(run.turns);
    const { usage, cost } = floor.totals;
    const data = {
      thread,
      workspace: workspace?.root,
      branch: workspace?.branch,
      startedAt: run.startedAt,
      acts: run.acts.length,
      models,
      usage,
      cost,
      agents: floor.agents,
      attention: floor.attention,
    };
    const lines = [
      `${threadKey(thread)}  ${thread.name ?? ""}`.trimEnd(),
      `  ${tilde(workspace?.root ?? thread.cwd)}${workspace?.branch ? ` (${workspace.branch})` : ""}  ${thread.status}  updated ${since(now, thread.updatedAt)}  ran ${duration((thread.updatedAt - run.startedAt) / 1000)}`,
      `  ${run.acts.length} acts  ${tokens(usage.output)} out${cost === undefined ? "" : `  ${dollars(cost)}`}  ${models.map((m) => `${modelName(m.model)} x${m.turns}`).join(", ") || "no model yet"}`,
      ...floor.agents.map(
        (a) =>
          `  ${"  ".repeat(a.depth)}${a.name}  ${a.state}${a.now ? `  ${a.now.label}` : ""}`,
      ),
    ];
    return { data, lines };
  });

const ls = Command.make(
  "ls",
  {
    ...output,
    ...scope,
    since: Flag.String("since").pipe(
      Flag.withDescription("updated within 90s, 15m, 2h or 3d"),
      Flag.optional,
    ),
    live: Flag.Boolean("live").pipe(
      Flag.withDescription("only threads with a process"),
      Flag.withDefault(false),
    ),
    past: Flag.Boolean("past").pipe(
      Flag.withDescription("only threads without a process"),
      Flag.withDefault(false),
    ),
    status: Flag.Literals("status", ["busy", "idle", "past"]).pipe(
      Flag.optional,
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, threadsLs(o, process.cwd()));
  },
).pipe(Command.withDescription(`List threads, newest first (${LIMIT} rows)`));

const show = Command.make(
  "show",
  {
    ...output,
    noProbe: scope.noProbe,
    thread: Argument.String("thread").pipe(
      Argument.withDescription(
        "an id, harness:id, id prefix, directory or part of a name",
      ),
      Argument.optional,
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, threadsShow(o.thread, o, process.cwd()));
  },
).pipe(
  Command.withDescription(
    "One thread: workspace, usage, models and its agents",
  ),
);

export const threads = Command.make("threads").pipe(
  Command.withDescription("List and inspect threads"),
  Command.withSubcommands([ls, show]),
);
