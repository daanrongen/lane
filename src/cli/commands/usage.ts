import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { readFloor } from "@/app/Snapshot.ts";
import { tilde } from "@/cli/commands/shared.ts";
import { emit } from "@/cli/emit.ts";
import { agentsWhere } from "@/cli/filters.ts";
import { output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import type { Reach } from "@/cli/thread.ts";
import type { AgentView } from "@/domain/floor.ts";
import { addUsage, emptyUsage } from "@/domain/run.ts";
import { dollars, tokens } from "@/ui/lib/format.ts";

export const BY = ["model", "harness", "workspace", "thread"] as const;
type By = (typeof BY)[number];

const keyOf = (a: AgentView, by: By) =>
  by === "model"
    ? (a.model ?? "unknown")
    : by === "harness"
      ? a.harness
      : by === "workspace"
        ? a.workspace
        : `${a.harness}:${a.thread}`;

export const usageBy = (by: By, o: Reach, cwd: string) =>
  Effect.gen(function* () {
    const { floor } = yield* readFloor({ all: o.all, probe: !o.noProbe });
    const groups = new Map<string, AgentView[]>();
    for (const a of agentsWhere(floor.agents, o, cwd)) {
      if (a.origin !== "thread") continue;
      groups.set(keyOf(a, by), [...(groups.get(keyOf(a, by)) ?? []), a]);
    }
    const rows = [...groups].map(([key, list]) => {
      const costs = list.flatMap((a) => (a.cost === undefined ? [] : [a.cost]));
      return {
        key,
        agents: list.length,
        usage: list.reduce((u, a) => addUsage(u, a.usage), emptyUsage),
        cost: costs.length ? costs.reduce((x, y) => x + y) : undefined,
      };
    });
    return table(
      [
        {
          header: by,
          raw: (r) => r.key,
          show: (r) => (by === "workspace" ? tilde(r.key) : r.key),
        },
        { header: "agents", raw: (r) => r.agents },
        {
          header: "input",
          raw: (r) => r.usage.input,
          show: (r) => tokens(r.usage.input),
        },
        {
          header: "output",
          raw: (r) => r.usage.output,
          show: (r) => tokens(r.usage.output),
        },
        {
          header: "cache read",
          raw: (r) => r.usage.cacheRead,
          show: (r) => tokens(r.usage.cacheRead),
        },
        {
          header: "cache write",
          raw: (r) => r.usage.cacheWrite,
          show: (r) => tokens(r.usage.cacheWrite),
        },
        {
          header: "cost",
          raw: (r) => r.cost,
          show: (r) => (r.cost === undefined ? "n/a" : dollars(r.cost)),
        },
      ],
      rows.sort((a, b) => b.usage.output - a.usage.output),
    );
  });

export const usage = Command.make(
  "usage",
  {
    ...output,
    ...scope,
    by: Flag.Literals("by", BY).pipe(
      Flag.withDescription("group by model, harness, workspace or thread"),
      Flag.withDefault("model"),
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, usageBy(o.by, o, process.cwd()));
  },
).pipe(
  Command.withDescription(
    "Tokens and spend where the harness reports it, n/a where it cannot",
  ),
);
