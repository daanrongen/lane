import type { HarnessProfile } from "@/domain/profile.ts";

// Ollama keeps no transcripts: its processes and the models it has loaded are seen.
export const ollamaProfile: HarnessProfile = {
  id: "ollama",
  name: "Ollama",
  facets: { process: "partial", runtime: "native" },
};
