import { BunFileSystem } from "@effect/platform-bun";
import { Effect, Layer, Schedule } from "effect";
import { AgentsHome } from "@/adapters/agents/AgentsHome.ts";
import { agentsAssets } from "@/adapters/agents/assets.ts";
import { claudeAssets } from "@/adapters/claude/assets.ts";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import { RunSourceFs } from "@/adapters/claude/RunSourceFs.ts";
import {
  processAlive,
  SessionCatalogFs,
} from "@/adapters/claude/SessionCatalogFs.ts";
import { codexAssets } from "@/adapters/codex/assets.ts";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { RunSourceCodex } from "@/adapters/codex/runs.ts";
import { SessionCatalogCodex } from "@/adapters/codex/sessions.ts";
import { assetReaderMemory } from "@/adapters/memory/AssetReaderMemory.ts";
import { RunSourceMemory } from "@/adapters/memory/RunSourceMemory.ts";
import { SessionCatalogMemory } from "@/adapters/memory/SessionCatalogMemory.ts";
import { ollamaAssets } from "@/adapters/ollama/assets.ts";
import { OllamaHome } from "@/adapters/ollama/OllamaHome.ts";
import {
  demoAssets,
  demoCodexEvents,
  demoCodexSession,
  demoEvents,
  demoSession,
} from "@/app/demo.ts";
import { SessionsStoreLive } from "@/app/SessionsStore.ts";
import { assetsOf } from "@/ports/Assets.ts";
import { harness, harnessesOf } from "@/ports/Harness.ts";

const sessionPoll = Schedule.spaced("1 second");

const claude = harness(
  "claude",
  Layer.mergeAll(
    SessionCatalogFs(processAlive),
    RunSourceFs(Schedule.spaced("500 millis")),
  ).pipe(Layer.provide(ClaudeHome.default)),
);

const codex = harness(
  "codex",
  Layer.mergeAll(
    SessionCatalogCodex,
    RunSourceCodex(Schedule.spaced("500 millis")),
  ).pipe(Layer.provide(CodexHome.default)),
);

// The agent harnesses on this machine, followed live.
const liveAssets = assetsOf(
  agentsAssets.pipe(Effect.provide(AgentsHome.default)),
  claudeAssets.pipe(Effect.provide(ClaudeHome.default)),
  codexAssets.pipe(Effect.provide(CodexHome.default)),
  ollamaAssets.pipe(Effect.provide(OllamaHome.default)),
);

export const LiveLayer = SessionsStoreLive(sessionPoll).pipe(
  Layer.provideMerge(harnessesOf(claude, codex)),
  Layer.provideMerge(liveAssets),
  Layer.provide(BunFileSystem.layer),
);

const demoClaude = harness(
  "claude",
  Layer.mergeAll(
    SessionCatalogMemory(() => [demoSession]),
    RunSourceMemory({ [demoSession.id]: demoEvents }),
  ),
);

const demoCodex = harness(
  "codex",
  Layer.mergeAll(
    SessionCatalogMemory(() => [demoCodexSession]),
    RunSourceMemory({ [demoCodexSession.id]: demoCodexEvents }),
  ),
);

// Scripted runs, so the UI works without any harness data.
export const DemoLayer = SessionsStoreLive(sessionPoll).pipe(
  Layer.provideMerge(harnessesOf(demoClaude, demoCodex)),
  Layer.provideMerge(assetsOf(assetReaderMemory("demo", demoAssets))),
);
