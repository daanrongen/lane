import { Effect } from "effect";
import type { Asset } from "@/domain/assets.ts";
import type { AssetReader } from "@/ports/Assets.ts";

export const assetReaderMemory = (
  source: string,
  assets: readonly Asset[],
): Effect.Effect<AssetReader> =>
  Effect.succeed({ source, read: () => Effect.succeed(assets) });
