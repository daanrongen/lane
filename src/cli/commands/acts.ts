import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { emit } from "@/cli/emit.ts";
import { limitOf } from "@/cli/filters.ts";
import { output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import { loadThread } from "@/cli/thread.ts";
import { isFailed } from "@/domain/act.ts";
import { refLabel } from "@/domain/pivot.ts";
import { clip, duration } from "@/ui/lib/format.ts";

const LATEST = 50;

export const actsList = (
  arg: string | undefined,
  o: {
    noProbe: boolean;
    limit?: string;
    kind?: string;
    failed: boolean;
    awaiting: boolean;
  },
  cwd: string,
) =>
  Effect.gen(function* () {
    const { run } = yield* loadThread(arg, o, cwd);
    const names = new Map(run.agents.map((a) => [a.id as string, a.name]));
    const rows = run.acts
      .filter(
        (a) =>
          (o.kind ? a.kind === o.kind : a.kind !== "think") &&
          (!o.failed || isFailed(a)) &&
          (!o.awaiting || a.status === "awaiting"),
      )
      .slice(-limitOf(o, LATEST));
    return table(
      [
        {
          header: "at",
          raw: (a) => run.startedAt + a.start * 1000,
          show: (a) => `+${duration(a.start)}`,
        },
        {
          header: "agent",
          raw: (a) => a.agentId,
          show: (a) => names.get(a.agentId) ?? a.agentId,
        },
        { header: "kind", raw: (a) => a.kind },
        { header: "status", raw: (a) => a.status },
        {
          header: "label",
          raw: (a) => a.label,
          show: (a) => clip(a.label, 60),
        },
        {
          header: "failure",
          raw: (a) => a.failure,
          show: (a) =>
            a.failure
              ? `${a.failure.class}: ${clip(a.failure.reason, 40)}`
              : "",
        },
        {
          header: "touches",
          raw: (a) => a.touches.map(refLabel),
          show: (a) => clip(a.touches.map(refLabel).join(", "), 40),
        },
      ],
      rows,
    );
  });

export const acts = Command.make(
  "acts",
  {
    ...output,
    noProbe: scope.noProbe,
    limit: scope.limit,
    thread: Argument.String("thread").pipe(
      Argument.withDescription("defaults to the newest thread here"),
      Argument.optional,
    ),
    kind: Flag.String("kind").pipe(
      Flag.withDescription("one kind; thinking is left out otherwise"),
      Flag.optional,
    ),
    failed: Flag.Boolean("failed").pipe(Flag.withDefault(false)),
    awaiting: Flag.Boolean("awaiting").pipe(
      Flag.withDescription("only calls waiting on a person"),
      Flag.withDefault(false),
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, actsList(o.thread, o, process.cwd()));
  },
).pipe(
  Command.withDescription(
    `Every act of a thread with status, failure and what it touched (latest ${LATEST})`,
  ),
);
