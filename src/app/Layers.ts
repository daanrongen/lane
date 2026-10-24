import { BunFileSystem } from "@effect/platform-bun";
import { Layer, Schedule } from "effect";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import { RunSourceFs } from "@/adapters/claude/RunSourceFs.ts";
import {
  processAlive,
  SessionCatalogFs,
} from "@/adapters/claude/SessionCatalogFs.ts";
import { RunSourceMemory } from "@/adapters/memory/RunSourceMemory.ts";
import { SessionCatalogMemory } from "@/adapters/memory/SessionCatalogMemory.ts";
import { demoEvents, demoSession } from "@/app/demo.ts";
import { SessionsStoreLive } from "@/app/SessionsStore.ts";
import { harness, harnessesOf } from "@/ports/Harness.ts";

const sessionPoll = Schedule.spaced("1 second");

const claude = harness(
  "claude",
  Layer.mergeAll(
    SessionCatalogFs(processAlive),
    RunSourceFs(Schedule.spaced("500 millis")),
  ).pipe(Layer.provide(ClaudeHome.default)),
);

// The agent harnesses on this machine, followed live.
export const LiveLayer = SessionsStoreLive(sessionPoll).pipe(
  Layer.provideMerge(harnessesOf(claude)),
  Layer.provide(BunFileSystem.layer),
);

const demo = harness(
  "claude",
  Layer.mergeAll(
    SessionCatalogMemory(() => [demoSession]),
    RunSourceMemory({ [demoSession.id]: demoEvents }),
  ),
);

// A scripted run, so the UI works without any harness data.
export const DemoLayer = SessionsStoreLive(sessionPoll).pipe(
  Layer.provideMerge(harnessesOf(demo)),
);
