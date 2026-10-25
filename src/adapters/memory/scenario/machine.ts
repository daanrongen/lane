import { Clock, Effect, Layer } from "effect";
import { claudeProfile } from "@/adapters/claude/profile.ts";
import { codexProfile } from "@/adapters/codex/profile.ts";
import {
  cycleEnd,
  type Loop,
  scriptedHarness,
} from "@/adapters/memory/ScriptedRuns.ts";
import {
  aiderStories,
  claudeStories,
  codexStories,
  DOCS,
  geminiStories,
  OPS,
  PRICING,
  SCRIPTS,
  SHOP,
} from "@/adapters/memory/scenario/stories.ts";
import type { HarnessProfile } from "@/domain/profile.ts";
import { within } from "@/domain/workspace.ts";
import { harnessesOf } from "@/ports/Harness.ts";
import { ProcessProbe } from "@/ports/ProcessProbe.ts";
import { Runtimes } from "@/ports/Runtimes.ts";
import { Workspaces } from "@/ports/Workspaces.ts";

export const LOOP_SECONDS = 180;
const GB = 1_000_000_000;

const grown = (
  p: HarnessProfile,
  facets: HarnessProfile["facets"],
): HarnessProfile => ({ ...p, facets: { ...p.facets, ...facets } });

// Claude Code and Codex as their adapters will report them; the others report less.
export const PROFILES = {
  claude: grown(claudeProfile, {
    edits: "native",
    hooks: "native",
    rules: "native",
    approvals: "native",
    plan: "native",
    git: "native",
    limits: "partial",
  }),
  codex: grown(codexProfile, {
    edits: "native",
    approvals: "native",
    sandbox: "native",
    plan: "native",
    limits: "native",
  }),
  gemini: {
    id: "gemini",
    name: "Gemini CLI",
    facets: {
      process: "partial",
      history: "native",
      subagents: "partial",
      toolcalls: "native",
      shell: "native",
      edits: "native",
      mcp: "native",
      usage: "native",
    },
  },
  aider: {
    id: "aider",
    name: "Aider",
    facets: {
      process: "partial",
      history: "partial",
      edits: "native",
      shell: "partial",
      approvals: "partial",
      context: "native",
      usage: "native",
      cost: "native",
      instructions: "native",
      git: "native",
    },
  },
} satisfies Record<string, HarnessProfile>;

const WORKSPACES = [
  { root: SHOP, branch: "feat/billing" },
  { root: PRICING, branch: "feat/pricing" },
  { root: OPS, branch: "main" },
  { root: DOCS, branch: "main" },
  { root: SCRIPTS, branch: "main" },
];

// A machine whose agents act out `LOOP_SECONDS` of work over and over.
export const scenario = (origin = Date.now()) => {
  const loop: Loop = { origin, seconds: LOOP_SECONDS };
  return {
    harnesses: harnessesOf(
      scriptedHarness("claude", PROFILES.claude, claudeStories, loop),
      scriptedHarness("codex", PROFILES.codex, codexStories, loop),
      scriptedHarness("gemini", PROFILES.gemini, geminiStories, loop),
      scriptedHarness("aider", PROFILES.aider, aiderStories, loop),
    ),
    workspaces: Layer.succeed(Workspaces, {
      of: (cwd) =>
        Effect.succeed(
          WORKSPACES.find((w) => within(w.root, cwd)) ?? { root: cwd },
        ),
    }),
    // A bare `ollama run` has no transcript, so it shows as a process.
    probe: Layer.succeed(ProcessProbe, {
      find: () =>
        Effect.succeed([
          {
            pid: 4242,
            command: "ollama run granite4",
            cwd: SCRIPTS,
            startedAt: origin - 600_000,
          },
        ]),
    }),
    runtimes: Layer.succeed(Runtimes, {
      list: Effect.map(Clock.currentTimeMillis, (now) => [
        {
          id: "ollama",
          kind: "ollama",
          name: "Ollama",
          models: [
            {
              name: "gpt-oss:20b",
              bytes: 13 * GB,
              vram: 13 * GB,
              expiresAt: cycleEnd(loop, now) + 60_000,
            },
            {
              name: "granite4",
              bytes: 2.1 * GB,
              vram: 2.1 * GB,
              expiresAt: cycleEnd(loop, now),
            },
          ],
        },
      ]),
    }),
  };
};
