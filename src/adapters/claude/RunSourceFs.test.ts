import { describe, expect, test } from "bun:test";
import { Effect, FileSystem, Layer, Schedule, Stream } from "effect";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import {
  assistant,
  iso,
  jsonl,
  result,
  runFs,
  toolUse,
} from "@/adapters/claude/fixtures.ts";
import { RunSourceFs } from "@/adapters/claude/RunSourceFs.ts";
import { foldAll } from "@/domain/fold.ts";
import { AgentId, ThreadId } from "@/domain/ids.ts";
import { emptyRun } from "@/domain/run.ts";
import { timeline } from "@/domain/timeline.ts";
import { RunSource } from "@/ports/RunSource.ts";

const SID = ThreadId("sess-1");
const SUB = "sub1";
const text = { type: "text" };

const meta = JSON.stringify({
  toolUseId: "ag1",
  agentType: "Explore",
  description: "scan",
});
const parent = [
  assistant(1, "m1", [toolUse("ag1", "Agent")]),
  result(2, "ag1"),
  assistant(9, "m2", [text]),
];
const child = [
  assistant(3, "c1", [toolUse("c-t1", "Read")]),
  result(5, "c-t1"),
  assistant(7, "c2", [text]),
];

const setup = (poll: Schedule.Schedule<unknown>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const home = yield* fs.makeTempDirectoryScoped();
    const dir = `${home}/projects/-proj`;
    const subs = `${dir}/${SID}/subagents`;
    const source = Layer.provide(RunSourceFs(poll), ClaudeHome.layer(home));
    return { fs, dir, subs, source };
  });

describe("RunSourceFs snapshot", () => {
  test("reads a session and its sub-agents into one timeline", () =>
    runFs(
      Effect.gen(function* () {
        const { fs, dir, subs, source } = yield* setup(Schedule.once);
        yield* fs.makeDirectory(subs, { recursive: true });
        yield* fs.writeFileString(`${dir}/${SID}.jsonl`, jsonl(parent));
        yield* fs.writeFileString(`${subs}/agent-${SUB}.meta.json`, meta);
        yield* fs.writeFileString(`${subs}/agent-${SUB}.jsonl`, jsonl(child));

        const events = yield* RunSource.use((s) =>
          Stream.runCollect(s.events(SID)),
        ).pipe(Effect.provide(source));

        const run = foldAll(emptyRun(SID, 0), events);
        const tl = timeline(run, 0);
        expect(
          tl.lanes.map((l) => [l.agent.name, l.depth, l.bars.length]),
        ).toEqual([
          ["main", 0, 1],
          ["Explore", 1, 1],
        ]);
        // The run starts at the first line (t=1s), so offsets shift by one.
        expect(tl.links).toEqual([
          { from: AgentId("main"), to: AgentId(SUB), at: 0, returnedAt: 6 },
        ]);
        expect(tl.usage.input).toBe(4);
        expect(run.startedAt).toBe(Date.parse(iso(1)));
      }),
    ));

  test("an unknown session fails with SourceError", () =>
    runFs(
      Effect.gen(function* () {
        const { fs, dir, source } = yield* setup(Schedule.once);
        yield* fs.makeDirectory(dir, { recursive: true });
        const error = yield* RunSource.use((s) =>
          Stream.runCollect(s.events(ThreadId("nope"))),
        ).pipe(Effect.provide(source), Effect.flip);
        expect(error._tag).toBe("SourceError");
      }),
    ));
});

describe("RunSourceFs following", () => {
  test("a sub-agent that appears after its spawn call still becomes a lane", () =>
    runFs(
      Effect.gen(function* () {
        const { fs, dir, subs, source } = yield* setup(
          Schedule.spaced("10 millis"),
        );
        yield* fs.makeDirectory(dir, { recursive: true });
        yield* fs.writeFileString(
          `${dir}/${SID}.jsonl`,
          jsonl(parent.slice(0, 1)),
        );

        const late = Effect.gen(function* () {
          yield* Effect.sleep("60 millis");
          yield* fs.makeDirectory(subs, { recursive: true });
          yield* fs.writeFileString(`${subs}/agent-${SUB}.jsonl`, jsonl(child));
          yield* fs.writeFileString(`${subs}/agent-${SUB}.meta.json`, meta);
        });

        const [events] = yield* Effect.all(
          [
            RunSource.use((s) =>
              Stream.runCollect(
                s
                  .events(SID)
                  .pipe(
                    Stream.takeUntil(
                      (e) => e._tag === "AgentSpawned" && e.agent.id === SUB,
                    ),
                  ),
              ),
            ).pipe(Effect.provide(source)),
            late,
          ],
          { concurrency: 2 },
        );

        expect(events.at(-1)).toMatchObject({
          _tag: "AgentSpawned",
          agent: { id: SUB, parentId: "main", name: "Explore" },
          at: 0,
        });
      }),
    ));
});
