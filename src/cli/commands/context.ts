import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { emit } from "@/cli/emit.ts";
import { output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import { loadThread } from "@/cli/thread.ts";
import { contextMap, windowFor } from "@/domain/context.ts";
import { AgentId } from "@/domain/ids.ts";
import { vitals } from "@/domain/vitals.ts";
import { percent, tokens } from "@/ui/lib/format.ts";

export const contextShow = (
  arg: string | undefined,
  o: { noProbe: boolean; agent?: string },
  cwd: string,
) =>
  Effect.gen(function* () {
    const { run } = yield* loadThread(arg, o, cwd);
    const id = AgentId(o.agent ?? "main");
    const v = vitals(run, id);
    const used = v.fill?.used ?? 0;
    const map = contextMap(
      run.context.filter((e) => e.agentId === id),
      run.setups.findLast((s) => s.agentId === id),
      used,
      v.fill?.window ?? windowFor(v.model, used),
    );
    return table(
      [
        { header: "kind", raw: (c) => c.kind },
        { header: "what", raw: (c) => c.label },
        {
          header: "tokens",
          raw: (c) => Math.round(c.tokens),
          show: (c) => tokens(Math.round(c.tokens)),
        },
        {
          header: "of window",
          raw: (c) => c.tokens / map.window,
          show: (c) => percent(c.tokens, map.window),
        },
        { header: "items", raw: (c) => c.count },
      ],
      map.cells,
    );
  });

export const context = Command.make(
  "context",
  {
    ...output,
    noProbe: scope.noProbe,
    thread: Argument.String("thread").pipe(
      Argument.withDescription("defaults to the newest thread here"),
      Argument.optional,
    ),
    agent: Flag.String("agent").pipe(
      Flag.withDescription("an agent id in the thread; the root by default"),
      Flag.optional,
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, contextShow(o.thread, o, process.cwd()));
  },
).pipe(Command.withDescription("What fills an agent's context window"));
