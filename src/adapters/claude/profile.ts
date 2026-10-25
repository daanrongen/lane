import type { HarnessProfile } from "@/domain/profile.ts";

// What the adapter provides today; it grows as the adapter catches up.
export const claudeProfile: HarnessProfile = {
  id: "claude",
  name: "Claude Code",
  facets: {
    process: "native",
    history: "native",
    subagents: "native",
    toolcalls: "native",
    shell: "native",
    edits: "partial",
    mcp: "native",
    skills: "native",
    hooks: "partial",
    rules: "partial",
    plan: "native",
    approvals: "native",
    tasks: "native",
    context: "partial",
    usage: "native",
    cost: "partial",
  },
};
