import { Layer, Stream } from "effect";
import type { RunEvent } from "@/domain/events.ts";
import { RunSource } from "@/ports/RunSource.ts";
import { SourceError } from "@/ports/SourceError.ts";

export const RunSourceMemory = (runs: Record<string, readonly RunEvent[]>) =>
  Layer.succeed(RunSource, {
    events: (id) => {
      const events = runs[id];
      return events
        ? Stream.fromIterable(events)
        : Stream.fail(new SourceError({ message: `no run ${id}` }));
    },
  });
