import type { HarnessProfile } from "@/domain/profile.ts";

// Ollama keeps no transcripts; only its processes are seen so far.
export const ollamaProfile: HarnessProfile = {
  id: "ollama",
  name: "Ollama",
  facets: { process: "partial" },
};
