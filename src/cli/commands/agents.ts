import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { readFloor } from "@/app/Snapshot.ts";
import { tilde } from "@/cli/commands/shared.ts";
import { emit } from "@/cli/emit.ts";
import { agentsWhere, limitOf, type Scope } from "@/cli/filters.ts";
import { CliError, output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import { clip, dollars, percent, tokens } from "@/ui/lib/format.ts";

type Reading = Scope & { all: boolean; noProbe: boolean };

const read = (o: Reading) => readFloor({ all: o.all, probe: !o.noProbe });

export const agentsLs = (o: Reading, cwd: string) =>
  Effect.gen(function* () {
    const { floor } = yield* read(o);
    return table(
      [
        { header: "state", raw: (a) => a.state },
        { header: "harness", raw: (a) => a.harness },
        {
          header: "agent",
          raw: (a) => a.ref,
          show: (a) => `${"  ".repeat(a.depth)}${a.name}`,
        },
        { header: "model", raw: (a) => a.model },
        {
          header: "context",
          raw: (a) => a.fill?.ratio,
          show: (a) => (a.fill?.ratio == null ? "" : percent(a.fill.ratio, 1)),
        },
        {
          header: "cost",
          raw: (a) => a.cost,
          show: (a) => (a.cost === undefined ? "" : dollars(a.cost)),
        },
        {
          header: "progress",
          raw: (a) => a.progress,
          show: (a) =>
            a.progress.total ? `${a.progress.done}/${a.progress.total}` : "",
        },
        {
          header: "now",
          raw: (a) => a.now?.label,
          show: (a) => clip(a.now?.label ?? "", 50),
        },
      ],
      agentsWhere(floor.agents, o, cwd).slice(0, limitOf(o)),
    );
  });

export const agentsShow = (arg: string | undefined, o: Reading) =>
  Effect.gen(function* () {
    const { floor } = yield* read(o);
    const found = floor.agents.filter(
      (a) => a.ref === arg || a.ref.includes(arg ?? "") || a.name === arg,
    );
    const exact = found.find((a) => a.ref === arg);
    const agent = exact ?? (found.length === 1 ? found[0] : undefined);
    if (!agent) {
      return yield* new CliError({
        message:
          found.length > 1
            ? `"${arg}" is ambiguous:\n${found.map((a) => a.ref).join("\n")}`
            : `no agent matches "${arg}"`,
        code: 3,
      });
    }
    const attention = floor.attention.filter((x) => x.agent === agent.ref);
    const lines = [
      `${agent.name}  ${agent.state}  ${agent.ref}`,
      `  ${tilde(agent.workspace)}`,
      ...(agent.now ? [`  now: ${agent.now.label}`] : []),
      `  ${agent.model ?? "no model yet"}  ${tokens(agent.usage.output)} out  ${agent.acts} acts (${agent.failed} failed)`,
      ...attention.map((x) => `  needs: ${x.reason} ${x.label}`),
      ...agent.insights.map((i) => `  insight: ${i}`),
    ];
    return { data: { agent, attention }, lines };
  });

const ls = Command.make(
  "ls",
  {
    ...output,
    ...scope,
    state: Flag.Literals("state", [
      "working",
      "waiting",
      "needs-you",
      "stalled",
      "failed",
      "idle",
      "done",
    ]).pipe(Flag.optional),
  },
  (c) => {
    const o = plain(c);
    return emit(o, agentsLs(o, process.cwd()));
  },
).pipe(
  Command.withDescription("Every agent on the floor, sub-agents indented"),
);

const show = Command.make(
  "show",
  {
    ...output,
    all: scope.all,
    noProbe: scope.noProbe,
    agent: Argument.String("agent").pipe(
      Argument.withDescription(
        "a full or partial harness:thread:agent ref, or a name",
      ),
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, agentsShow(o.agent, { ...o, all: o.all }));
  },
).pipe(
  Command.withDescription("One agent: what it is doing and what holds it up"),
);

export const agents = Command.make("agents").pipe(
  Command.withDescription("List and inspect agents"),
  Command.withSubcommands([ls, show]),
);
