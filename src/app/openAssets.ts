import { Effect, Schedule, Stream, SubscriptionRef } from "effect";
import type { Asset } from "@/domain/assets.ts";
import { Assets } from "@/ports/Assets.ts";

// Setup changes rarely, so the default refresh is slow.
const REFRESH = Schedule.spaced("10 seconds");

// Everything every reader finds for the project at `cwd`, refreshed until the scope closes.
export const openAssets = (
  cwd: string,
  refresh: Schedule.Schedule<unknown> = REFRESH,
) =>
  Effect.gen(function* () {
    const readers = yield* Assets;
    const assets = yield* SubscriptionRef.make<readonly Asset[]>([]);
    const readAll = Effect.forEach(
      readers,
      (r) => r.read(cwd).pipe(Effect.orElseSucceed((): readonly Asset[] => [])),
      { concurrency: "unbounded" },
    ).pipe(Effect.map((all) => all.flat()));
    // Read once straight away, then on the refresh schedule.
    yield* Stream.make(undefined).pipe(
      Stream.concat(Stream.fromSchedule(refresh)),
      Stream.mapEffect(() => readAll),
      Stream.runForEach((next) => SubscriptionRef.set(assets, next)),
      Effect.forkScoped,
    );
    return { assets };
  });
