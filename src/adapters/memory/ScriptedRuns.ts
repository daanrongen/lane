import { Clock, Effect, Layer, Schedule, Stream } from "effect";
import type { RunEvent } from "@/domain/events.ts";
import { ThreadId } from "@/domain/ids.ts";
import type { HarnessProfile } from "@/domain/profile.ts";
import type { Task } from "@/domain/task.ts";
import type { HarnessId, Thread } from "@/domain/thread.ts";
import { harness } from "@/ports/Harness.ts";
import { RunSource } from "@/ports/RunSource.ts";
import { SourceError } from "@/ports/SourceError.ts";
import { TaskRepository } from "@/ports/TaskRepository.ts";
import { ThreadRepository } from "@/ports/ThreadRepository.ts";

export interface Beat {
  // Seconds into the story.
  readonly at: number;
  readonly event: RunEvent;
}

export interface Script {
  readonly key: string;
  readonly thread: Pick<Thread, "cwd" | "status" | "name">;
  // Seconds into the story when each cycle begins.
  readonly age: number;
  // Seconds since a thread that is over last did anything.
  readonly quiet?: number;
  // `thread` names another script's thread in this cycle.
  readonly beats: (thread: (key: string) => ThreadId) => readonly Beat[];
  readonly tasks?: readonly Task[];
}

// The stories start over every `seconds`, each time as new threads.
export interface Loop {
  readonly origin: number;
  readonly seconds: number;
}

const cycleOf = (loop: Loop, now: number) =>
  Math.floor((now - loop.origin) / (loop.seconds * 1000));

// Epoch ms when the cycle running at `now` ends.
export const cycleEnd = (loop: Loop, now: number) =>
  loop.origin + (cycleOf(loop, now) + 1) * loop.seconds * 1000;

const idOf = (key: string, cycle: number) => ThreadId(`${key}#${cycle}`);

const parse = (id: string) => {
  const at = id.lastIndexOf("#");
  return { key: id.slice(0, at), cycle: Number(id.slice(at + 1)) };
};

// A quota in a story resets some seconds into it; on the wire it is epoch ms.
const anchored = (e: RunEvent, began: number): RunEvent =>
  e._tag === "SignalReported" &&
  e.reading.signal._tag === "Limit" &&
  e.reading.signal.resetsAt !== undefined
    ? {
        ...e,
        reading: {
          ...e.reading,
          signal: {
            ...e.reading.signal,
            resetsAt: began + e.reading.signal.resetsAt * 1000,
          },
        },
      }
    : e;

// Stories that play out in real time, so a demo ticks like a live machine.
export const scriptedHarness = (
  id: HarnessId,
  profile: HarnessProfile,
  scripts: readonly Script[],
  loop: Loop,
) => {
  const find = (thread: string) => {
    const { key, cycle } = parse(thread);
    const script = scripts.find((s) => s.key === key);
    return script && !Number.isNaN(cycle) ? { script, cycle } : undefined;
  };

  const events = (thread: ThreadId): Stream.Stream<RunEvent, SourceError> =>
    Stream.suspend(() => {
      const found = find(thread);
      if (!found) {
        return Stream.fail(new SourceError({ message: `no run ${thread}` }));
      }
      const { script, cycle } = found;
      const beats = [...script.beats((k) => idOf(k, cycle))].sort(
        (a, b) => a.at - b.at,
      );
      const began =
        loop.origin + cycle * loop.seconds * 1000 - script.age * 1000;
      let sent = 0;
      const due = Effect.map(Clock.currentTimeMillis, (now) => {
        const upto = beats.filter((b) => b.at * 1000 <= now - began).length;
        const out = beats
          .slice(sent, upto)
          .map((b) => anchored(b.event, began));
        sent = upto;
        return out;
      });
      const started: RunEvent = { _tag: "RunStarted", startedAt: began };
      return Stream.make(started).pipe(
        Stream.concat(
          Stream.make(undefined).pipe(
            Stream.concat(Stream.fromSchedule(Schedule.spaced("250 millis"))),
            Stream.mapEffect(() => due),
            Stream.flattenIterable,
          ),
        ),
      );
    });

  const list = Effect.map(Clock.currentTimeMillis, (now) =>
    scripts.map(
      (s): Thread => ({
        ...s.thread,
        harness: id,
        id: idOf(s.key, cycleOf(loop, now)),
        updatedAt: now - (s.quiet ?? 0) * 1000,
      }),
    ),
  );

  return harness(
    id,
    Layer.mergeAll(
      Layer.succeed(ThreadRepository, { list }),
      Layer.succeed(RunSource, { events }),
      Layer.succeed(TaskRepository, {
        tasks: (t) => Stream.make(find(t.id)?.script.tasks ?? []),
      }),
    ),
    profile,
  );
};
