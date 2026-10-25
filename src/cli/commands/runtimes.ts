import { Clock, Effect } from "effect";
import { Command } from "effect/cli";
import { emit } from "@/cli/emit.ts";
import { output, plain } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import type { LoadedModel } from "@/domain/runtime.ts";
import { Runtimes } from "@/ports/Runtimes.ts";
import { ago, bytes } from "@/ui/lib/format.ts";

interface Row {
  readonly runtime: string;
  readonly model: LoadedModel;
}

export const runtimesList = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis;
  const runtimes = yield* (yield* Runtimes).list;
  const rows = runtimes.flatMap((r) =>
    r.models.map((model): Row => ({ runtime: r.name, model })),
  );
  return table(
    [
      { header: "runtime", raw: (r: Row) => r.runtime },
      { header: "model", raw: (r) => r.model.name },
      {
        header: "size",
        raw: (r) => r.model.bytes,
        show: (r) => bytes(r.model.bytes),
      },
      {
        header: "vram",
        raw: (r) => r.model.vram,
        show: (r) => (r.model.vram === undefined ? "" : bytes(r.model.vram)),
      },
      {
        header: "unloads",
        raw: (r) => r.model.expiresAt,
        show: (r) =>
          r.model.expiresAt === undefined
            ? ""
            : `in ${ago(r.model.expiresAt - now)}`,
      },
    ],
    rows,
  );
});

export const runtimes = Command.make("runtimes", { ...output }, (c) =>
  emit(plain(c), runtimesList),
).pipe(
  Command.withDescription(
    "What agents run on now: the models a local Ollama has loaded",
  ),
);
