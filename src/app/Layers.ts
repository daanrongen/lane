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

const sessionPoll = Schedule.spaced("1 second");

// Claude Code's real data on this machine, followed live.
export const LiveLayer = Layer.mergeAll(
  SessionsStoreLive(sessionPoll).pipe(
    Layer.provide(SessionCatalogFs(processAlive)),
  ),
  RunSourceFs(Schedule.spaced("500 millis")),
).pipe(Layer.provide(Layer.mergeAll(BunFileSystem.layer, ClaudeHome.default)));

// A scripted run, so the UI works without any Claude Code data.
export const DemoLayer = Layer.mergeAll(
  SessionsStoreLive(sessionPoll).pipe(
    Layer.provide(SessionCatalogMemory(() => [demoSession])),
  ),
  RunSourceMemory({ [demoSession.id]: demoEvents }),
);
