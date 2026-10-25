import type { HarnessProfile } from "@/domain/profile.ts";

// What the adapter provides today; it grows as the adapter catches up.
export const codexProfile: HarnessProfile = {
  id: "codex",
  name: "Codex",
  facets: {
    process: "partial",
    history: "native",
    subagents: "native",
    toolcalls: "native",
    shell: "native",
    edits: "partial",
    mcp: "partial",
    skills: "partial",
    sandbox: "partial",
    plan: "partial",
    tasks: "native",
    goals: "native",
    context: "native",
    usage: "native",
  },
};
