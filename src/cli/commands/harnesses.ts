import { Effect } from "effect";
import { Command } from "effect/cli";
import { ollamaProfile } from "@/adapters/ollama/profile.ts";
import { emit } from "@/cli/emit.ts";
import { output, plain } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import { FACETS, support } from "@/domain/profile.ts";
import { Harnesses } from "@/ports/Harness.ts";

export const harnessMatrix = Effect.gen(function* () {
  const harnesses = yield* Harnesses;
  const profiles = [...harnesses.map((h) => h.profile), ollamaProfile];
  return table(
    [
      { header: "facet", raw: (f: (typeof FACETS)[number]) => f },
      ...profiles.map((p) => ({
        header: p.id,
        raw: (f: (typeof FACETS)[number]) => support(p, f),
        show: (f: (typeof FACETS)[number]) =>
          support(p, f) === "none" ? "n/a" : support(p, f),
      })),
    ],
    FACETS,
  );
});

export const harnesses = Command.make("harnesses", { ...output }, (c) =>
  emit(plain(c), harnessMatrix),
).pipe(
  Command.withDescription(
    "What each harness can report: native, partial, or n/a (not the same as zero)",
  ),
);
