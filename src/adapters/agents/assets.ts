import { Effect, FileSystem } from "effect";
import { AgentsHome } from "@/adapters/agents/AgentsHome.ts";
import { readSkills } from "@/adapters/shared/skills.ts";
import type { AssetReader } from "@/ports/Assets.ts";

// Skills shared across harnesses.
export const agentsAssets = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const home = yield* AgentsHome;
  const reader: AssetReader = {
    source: "agents",
    read: () => readSkills(fs, `${home}/skills`, "agents"),
  };
  return reader;
});
