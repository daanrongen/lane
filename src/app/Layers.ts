import { BunFileSystem } from "@effect/platform-bun";
import { Effect, Layer, Schedule } from "effect";
import { AgentsHome } from "@/adapters/agents/AgentsHome.ts";
import { agentsAssets } from "@/adapters/agents/assets.ts";
import { claudeAssets } from "@/adapters/claude/assets.ts";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import { claudeProfile } from "@/adapters/claude/profile.ts";
import { RunSourceFs } from "@/adapters/claude/RunSourceFs.ts";
import {
  processAlive,
  ThreadRepositoryFs,
} from "@/adapters/claude/ThreadRepositoryFs.ts";
import { TaskRepositoryFs } from "@/adapters/claude/tasks.ts";
import { codexAssets } from "@/adapters/codex/assets.ts";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { codexProfile } from "@/adapters/codex/profile.ts";
import { RunSourceCodex } from "@/adapters/codex/runs.ts";
import { TaskRepositoryCodex } from "@/adapters/codex/tasks.ts";
import { ThreadRepositoryCodex } from "@/adapters/codex/threads.ts";
import { assetReaderMemory } from "@/adapters/memory/AssetReaderMemory.ts";
import { RunSourceMemory } from "@/adapters/memory/RunSourceMemory.ts";
import { TaskRepositoryMemory } from "@/adapters/memory/TaskRepositoryMemory.ts";
import { ThreadRepositoryMemory } from "@/adapters/memory/ThreadRepositoryMemory.ts";
import { ollamaAssets } from "@/adapters/ollama/assets.ts";
import { OllamaHome } from "@/adapters/ollama/OllamaHome.ts";
import { ollamaProfile } from "@/adapters/ollama/profile.ts";
import { ProcessProbePs } from "@/adapters/process/ProcessProbePs.ts";
import { WorkspacesFs } from "@/adapters/workspace/WorkspacesFs.ts";
import {
  demoAssets,
  demoCodexEvents,
  demoCodexSession,
  demoCodexTasks,
  demoEvents,
  demoSession,
  demoTasks,
} from "@/app/demo.ts";
import { FleetLive } from "@/app/Fleet.ts";
import { SessionsStoreLive } from "@/app/SessionsStore.ts";
import { assetsOf } from "@/ports/Assets.ts";
import { harness, harnessesOf } from "@/ports/Harness.ts";
import { ProcessProbe } from "@/ports/ProcessProbe.ts";
import { Workspaces } from "@/ports/Workspaces.ts";

const sessionPoll = Schedule.spaced("1 second");

const claude = harness(
  "claude",
  Layer.mergeAll(
    ThreadRepositoryFs(processAlive),
    RunSourceFs(Schedule.spaced("500 millis")),
    TaskRepositoryFs(Schedule.spaced("500 millis")),
  ).pipe(Layer.provide(ClaudeHome.default)),
  claudeProfile,
);

const codex = harness(
  "codex",
  Layer.mergeAll(
    ThreadRepositoryCodex,
    RunSourceCodex(Schedule.spaced("500 millis")),
    TaskRepositoryCodex(Schedule.spaced("500 millis")),
  ).pipe(Layer.provide(CodexHome.default)),
  codexProfile,
);

// The agent harnesses on this machine, followed live.
const liveAssets = assetsOf(
  agentsAssets.pipe(Effect.provide(AgentsHome.default)),
  claudeAssets.pipe(Effect.provide(ClaudeHome.default)),
  codexAssets.pipe(Effect.provide(CodexHome.default)),
  ollamaAssets.pipe(Effect.provide(OllamaHome.default)),
);

export const LiveLayer = FleetLive({ profiles: [ollamaProfile] }).pipe(
  Layer.provideMerge(SessionsStoreLive(sessionPoll)),
  Layer.provideMerge(harnessesOf(claude, codex)),
  Layer.provideMerge(liveAssets),
  Layer.provideMerge(ProcessProbePs),
  Layer.provideMerge(WorkspacesFs),
  Layer.provide(BunFileSystem.layer),
);

const demoClaude = harness(
  "claude",
  Layer.mergeAll(
    ThreadRepositoryMemory(() => [demoSession]),
    RunSourceMemory({ [demoSession.id]: demoEvents }),
    TaskRepositoryMemory({ [demoSession.id]: demoTasks }),
  ),
);

const demoCodex = harness(
  "codex",
  Layer.mergeAll(
    ThreadRepositoryMemory(() => [demoCodexSession]),
    RunSourceMemory({ [demoCodexSession.id]: demoCodexEvents }),
    TaskRepositoryMemory({ [demoCodexSession.id]: demoCodexTasks }),
  ),
);

// Scripted runs, so the UI works without any harness data.
export const DemoLayer = FleetLive().pipe(
  Layer.provideMerge(SessionsStoreLive(sessionPoll)),
  Layer.provideMerge(harnessesOf(demoClaude, demoCodex)),
  Layer.provideMerge(assetsOf(assetReaderMemory("demo", demoAssets))),
  Layer.provideMerge(ProcessProbe.none),
  Layer.provideMerge(Workspaces.flat),
);
