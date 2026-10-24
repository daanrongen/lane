import { describe, expect, test } from "bun:test";
import { Effect, type Layer, Schedule, SubscriptionRef } from "effect";
import { assetReaderMemory } from "@/adapters/memory/AssetReaderMemory.ts";
import { openAssets } from "@/app/openAssets.ts";
import { until } from "@/app/testing.ts";
import type { Asset } from "@/domain/assets.ts";
import { type Assets, assetsOf } from "@/ports/Assets.ts";
import { SourceError } from "@/ports/SourceError.ts";

const skill = (source: string, name: string): Asset => ({
  _tag: "Skill",
  source,
  name,
  description: "",
});

const run = <A, E>(
  self: Effect.Effect<A, E, Assets | import("effect").Scope.Scope>,
  layer: Layer.Layer<Assets>,
) => Effect.runPromise(self.pipe(Effect.provide(layer), Effect.scoped));

describe("openAssets", () => {
  test("merges what every reader finds", () =>
    run(
      Effect.gen(function* () {
        const { assets } = yield* openAssets(
          "/x",
          Schedule.spaced("10 millis"),
        );
        const seen = yield* until(
          SubscriptionRef.get(assets),
          (a) => a.length === 2,
        );
        expect(seen.map((a) => a._tag === "Skill" && a.source)).toEqual([
          "a",
          "b",
        ]);
      }),
      assetsOf(
        assetReaderMemory("a", [skill("a", "x")]),
        assetReaderMemory("b", [skill("b", "y")]),
      ),
    ));

  test("a reader that fails contributes nothing", () =>
    run(
      Effect.gen(function* () {
        const { assets } = yield* openAssets(
          "/x",
          Schedule.spaced("10 millis"),
        );
        const seen = yield* until(
          SubscriptionRef.get(assets),
          (a) => a.length === 1,
        );
        expect(seen).toHaveLength(1);
      }),
      assetsOf(
        assetReaderMemory("ok", [skill("ok", "x")]),
        Effect.succeed({
          source: "broken",
          read: () => Effect.fail(new SourceError({ message: "boom" })),
        }),
      ),
    ));
});
