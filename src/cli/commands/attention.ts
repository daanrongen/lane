import { Clock, Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { readFloor } from "@/app/Snapshot.ts";
import { since } from "@/cli/commands/shared.ts";
import { emit } from "@/cli/emit.ts";
import { output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";

export const attentionList = (o: { all: boolean; noProbe: boolean }) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const { floor } = yield* readFloor({ all: o.all, probe: !o.noProbe });
    const who = new Map(floor.agents.map((a) => [a.ref, a]));
    return table(
      [
        { header: "reason", raw: (x) => x.reason },
        {
          header: "agent",
          raw: (x) => x.agent,
          show: (x) => who.get(x.agent)?.name ?? x.agent,
        },
        { header: "harness", raw: (x) => who.get(x.agent)?.harness },
        { header: "detail", raw: (x) => x.label },
        {
          header: "since",
          raw: (x) => x.since,
          show: (x) => since(now, x.since) ?? "",
        },
      ],
      floor.attention,
    );
  });

export const attention = Command.make(
  "attention",
  {
    ...output,
    all: scope.all,
    noProbe: scope.noProbe,
    exitCode: Flag.Boolean("exit-code").pipe(
      Flag.withDescription("exit 1 when anyone needs attention"),
      Flag.withDefault(false),
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, attentionList(o), (out) =>
      o.exitCode && "raw" in out && out.raw.length > 0 ? 1 : 0,
    );
  },
).pipe(
  Command.withDescription(
    "Who needs you, is stalled, failed or near a limit, and for how long",
  ),
);
