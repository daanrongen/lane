import type { AgentView } from "@/domain/floor.ts";
import { baseName } from "@/domain/workspace.ts";

// Every word typed must appear somewhere in what an agent shows.
const haystack = (a: AgentView) =>
  [a.name, a.harness, a.state, a.model, a.provider, baseName(a.workspace)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export const search = (agents: readonly AgentView[], query: string) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return agents.filter((a) => {
    const text = haystack(a);
    return words.every((w) => text.includes(w));
  });
};
