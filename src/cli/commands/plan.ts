import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { emit } from "@/cli/emit.ts";
import { output, plain, scope } from "@/cli/options.ts";
import { loadThread } from "@/cli/thread.ts";

export const planShow = (
  arg: string | undefined,
  o: { noProbe: boolean },
  cwd: string,
) =>
  Effect.gen(function* () {
    const { run } = yield* loadThread(arg, o, cwd);
    const names = new Map(run.agents.map((a) => [a.id as string, a.name]));
    const lines = run.plans.length
      ? run.plans.flatMap((p) => [
          `${p.status}  ${p.title}  (${names.get(p.agentId) ?? p.agentId})`,
          ...p.steps.map((s, i) => `  ${i + 1}. ${s}`),
        ])
      : ["no plan proposed"];
    return { data: run.plans, lines };
  });

export const plan = Command.make(
  "plan",
  {
    ...output,
    noProbe: scope.noProbe,
    thread: Argument.String("thread").pipe(
      Argument.withDescription("defaults to the newest thread here"),
      Argument.optional,
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, planShow(o.thread, o, process.cwd()));
  },
).pipe(
  Command.withDescription("Plans an agent put to a person, with their steps"),
);
