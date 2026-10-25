import type { AgentView, Floor } from "@/domain/floor.ts";
import { refLabel, refsOf } from "@/domain/pivot.ts";
import type { Ref } from "@/domain/ref.ts";
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

export type Hit =
  | { readonly agent: AgentView }
  | { readonly ref: Ref; readonly count: number }
  | { readonly text: string };

// Agents first, then what they touched, then the query as a feed filter.
export const find = (
  floor: Floor,
  agents: readonly AgentView[],
  query: string,
): Hit[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return agents.map((agent) => ({ agent }));
  const refs = refsOf(floor).filter(({ ref }) => {
    const text = `${ref._tag} ${refLabel(ref)}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
  return [
    ...search(agents, query).map((agent) => ({ agent })),
    ...refs,
    { text: query.trim() },
  ];
};
