import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { readFloor } from "@/app/Snapshot.ts";
import { emit } from "@/cli/emit.ts";
import { output, plain, scope } from "@/cli/options.ts";
import type { AgentState } from "@/domain/agent.ts";
import { dollars, tokens } from "@/ui/lib/format.ts";

const ORDER: readonly AgentState[] = [
  "needs-you",
  "failed",
  "stalled",
  "working",
  "waiting",
  "idle",
  "done",
];

export const statusOf = (o: {
  all: boolean;
  noProbe: boolean;
  line: boolean;
}) =>
  Effect.gen(function* () {
    const { floor } = yield* readFloor({ all: o.all, probe: !o.noProbe });
    const { states, usage, cost } = floor.totals;
    const harnesses: Record<string, number> = {};
    for (const a of floor.agents) {
      harnesses[a.harness] = (harnesses[a.harness] ?? 0) + 1;
    }
    const counts = ORDER.filter((s) => states[s] > 0).map(
      (s) => `${states[s]} ${s}`,
    );
    const spend = [
      `${tokens(usage.output)} out`,
      ...(cost === undefined ? [] : [dollars(cost)]),
    ];
    const data = {
      at: floor.at,
      agents: floor.agents.length,
      states,
      harnesses,
      attention: floor.attention.length,
      workspaces: floor.workspaces.length,
      usage,
      cost,
      unreadable: floor.unreadable,
    };
    const line = [...(counts.length ? counts : ["no agents"]), ...spend].join(
      " · ",
    );
    const lines = o.line
      ? [line]
      : [
          line,
          ...(floor.attention.length
            ? [`${floor.attention.length} need attention (lane attention)`]
            : []),
          ...(floor.unreadable.length
            ? [`cannot read: ${floor.unreadable.join(", ")}`]
            : []),
        ];
    return { data, lines };
  });

export const status = Command.make(
  "status",
  {
    ...output,
    all: scope.all,
    noProbe: scope.noProbe,
    line: Flag.Boolean("line").pipe(
      Flag.withDescription("one line, for a prompt or status bar"),
      Flag.withDefault(false),
    ),
  },
  (c) => {
    const o = plain(c);
    // A line is for a prompt, so it stays text when piped.
    return emit(o.line ? { ...o, format: "table" } : o, statusOf(o));
  },
).pipe(
  Command.withDescription(
    "The machine at a glance: agents by state, who needs you, tokens and spend",
  ),
);
